import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Rate, Trend } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:5099';
const duration = __ENV.DURATION || '2m';
const routePollTimeoutSeconds = Number(__ENV.ROUTE_POLL_TIMEOUT_SECONDS || 15);

const mapRate = Number(__ENV.MAP_RATE || 18);
const hazardRate = Number(__ENV.HAZARD_RATE || 14);
const opsRate = Number(__ENV.OPS_RATE || 8);
const routeRate = Number(__ENV.ROUTE_RATE || 4);
const accountRate = Number(__ENV.ACCOUNT_RATE || 3);

export const frontendApiFailure = new Rate('frontend_api_failure');
export const routeJobTimeout = new Rate('route_job_timeout');
export const routeEndToEndMs = new Trend('route_end_to_end_ms');

http.setResponseCallback(http.expectedStatuses(
  { min: 200, max: 399 },
  400,
  404,
  429,
  503,
  504,
));

function scenario(rate, preAllocatedVUs, maxVUs, execName) {
  return {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration,
    preAllocatedVUs,
    maxVUs,
    exec: execName,
    gracefulStop: '30s',
  };
}

const scenarios = {};
if (mapRate > 0) scenarios.map_screen = scenario(mapRate, 40, 200, 'mapScreen');
if (hazardRate > 0) scenarios.hazard_screen = scenario(hazardRate, 30, 150, 'hazardScreen');
if (opsRate > 0) scenarios.ops_screen = scenario(opsRate, 25, 120, 'opsScreen');
if (routeRate > 0) scenarios.routing = scenario(routeRate, 40, 240, 'routing');
if (accountRate > 0) scenarios.account_screen = scenario(accountRate, 10, 60, 'accountScreen');

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
    frontend_api_failure: ['rate<0.03'],
    route_job_timeout: ['rate<0.02'],
    http_req_duration: ['p(95)<1200', 'p(99)<3000'],
    'http_req_duration{name:account-profile}': ['p(95)<500'],
    'http_req_duration{name:dashboard-summary}': ['p(95)<500'],
    'http_req_duration{name:hazards-page}': ['p(95)<500'],
    'http_req_duration{name:poi}': ['p(95)<700'],
    'http_req_duration{name:risk-score}': ['p(95)<500'],
    'http_req_duration{name:route-submit}': ['p(95)<1200'],
  },
};

const jsonHeaders = { headers: { 'Content-Type': 'application/json' }, timeout: '8s' };
const routePairs = [
  [-1.8985, 52.4814, -1.9300, 52.4510],
  [-1.8904, 52.4862, -1.8894, 52.4862],
  [-1.8885, 52.4835, -1.8936, 52.4795],
  [-1.9125, 52.4855, -1.9015, 52.4805],
];

function ok(response, allowed = [200]) {
  const passed = allowed.includes(response.status);
  frontendApiFailure.add(!passed);
  return passed;
}

function parseJson(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

function offset(width = 401, step = 0.00001) {
  return ((exec.scenario.iterationInTest % width) - Math.floor(width / 2)) * step;
}

function authHeaders(data) {
  return data?.token
    ? { headers: { Authorization: `Bearer ${data.token}` }, timeout: '5s' }
    : { timeout: '5s' };
}

export function setup() {
  const email = `load-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  const register = http.post(`${baseUrl}/api/v1/auth/register`, JSON.stringify({
    email,
    password: 'P@ssword123!',
    fullName: 'Load Test User',
  }), jsonHeaders);

  const hazards = http.get(`${baseUrl}/api/v1/hazards/page?limit=1`, { timeout: '5s' });

  return {
    token: register.status >= 200 && register.status < 300 ? register.json('token') || '' : '',
    firstHazardId: hazards.status === 200 ? hazards.json('items.0.id') || '' : '',
  };
}

export function mapScreen() {
  const delta = offset();
  const lat = 52.4862 + delta;
  const lng = -1.8904 - delta;

  check(http.get(`${baseUrl}/api/v1/hazards/page?status=Reported&limit=100`, {
    timeout: '4s',
    tags: { name: 'hazards-page' },
  }), { 'map hazards ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/routing/risk-score?lat=${lat}&lng=${lng}&radius=500`, {
    timeout: '4s',
    tags: { name: 'risk-score' },
  }), { 'risk ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/routing/ai-risk-score?lat=${lat}&lng=${lng}&radius=500`, {
    timeout: '4s',
    tags: { name: 'ai-risk-score' },
  }), { 'ai risk ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/spatial/poi?lat=${lat}&lng=${lng}&radius=800`, {
    timeout: '4s',
    tags: { name: 'poi' },
  }), { 'poi ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/safe-haven/nearby?lat=${lat}&lng=${lng}&radius=800`, {
    timeout: '4s',
    tags: { name: 'safe-haven' },
  }), { 'safe haven ok': (r) => ok(r, [200]) });
}

export function hazardScreen(data) {
  check(http.get(`${baseUrl}/api/v1/hazards/page?status=Reported&limit=25`, {
    timeout: '4s',
    tags: { name: 'hazards-page' },
  }), { 'hazard page ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/hazards/page?status=Acknowledged&limit=25&query=barrier`, {
    timeout: '4s',
    tags: { name: 'hazards-search' },
  }), { 'hazard search ok': (r) => ok(r, [200]) });

  if (data.firstHazardId) {
    check(http.get(`${baseUrl}/api/v1/hazards/${encodeURIComponent(data.firstHazardId)}`, {
      timeout: '4s',
      tags: { name: 'hazard-detail' },
    }), { 'hazard detail ok': (r) => ok(r, [200, 404]) });
  }
}

export function opsScreen() {
  check(http.get(`${baseUrl}/api/v1/dashboard/summary`, {
    timeout: '4s',
    tags: { name: 'dashboard-summary' },
  }), { 'summary ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/dashboard/heat-map`, {
    timeout: '4s',
    tags: { name: 'dashboard-heat-map' },
  }), { 'heat map ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/dashboard/infrastructure-feed?limit=8`, {
    timeout: '4s',
    tags: { name: 'dashboard-feed' },
  }), { 'feed ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/routing/route-graph/status`, {
    timeout: '4s',
    tags: { name: 'route-graph-status' },
  }), { 'route graph status ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/spatial/map-overlay?layerName=hazards`, {
    timeout: '4s',
    tags: { name: 'map-overlay' },
  }), { 'overlay ok': (r) => ok(r, [200]) });
}

export function routing() {
  const started = Date.now();
  const pair = routePairs[exec.scenario.iterationInTest % routePairs.length];
  const delta = offset(101, 0.00002);
  const profile = exec.scenario.iterationInTest % 3 === 0 ? 'manual-wheelchair' : 'standard';
  const body = JSON.stringify({
    start: { x: pair[0] + delta, y: pair[1] - delta },
    end: { x: pair[2] - delta, y: pair[3] + delta },
    preferences: profile === 'manual-wheelchair' ? ['wheelchair', 'avoid-reported-hazards'] : ['avoid-reported-hazards'],
    safetyWeight: 0.65,
    profile,
  });

  const response = http.post(`${baseUrl}/api/v1/routing/safe-path/options`, body, {
    ...jsonHeaders,
    tags: { name: 'route-submit' },
  });

  check(response, { 'route accepted': (r) => ok(r, [200, 202, 404]) });
  if (response.status !== 202) {
    routeEndToEndMs.add(Date.now() - started);
    return;
  }

  const payload = parseJson(response);
  if (!payload?.jobId) {
    routeJobTimeout.add(true);
    return;
  }

  const deadline = Date.now() + routePollTimeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const poll = http.get(`${baseUrl}/api/v1/routing/jobs/${encodeURIComponent(payload.jobId)}`, {
      timeout: '3s',
      tags: { name: 'route-poll' },
    });
    const bodyJson = parseJson(poll);
    if (poll.status === 200 && (bodyJson?.status === 'Completed' || bodyJson?.status === 2)) {
      routeJobTimeout.add(false);
      routeEndToEndMs.add(Date.now() - started);
      return;
    }

    if (poll.status >= 500 || poll.status === 429 || bodyJson?.status === 'Failed' || bodyJson?.status === 3) {
      routeJobTimeout.add(true);
      return;
    }

    sleep(0.2);
  }

  routeJobTimeout.add(true);
}

export function accountScreen(data) {
  if (!data.token) {
    return;
  }

  check(http.get(`${baseUrl}/api/v1/account/profile`, {
    ...authHeaders(data),
    tags: { name: 'account-profile' },
  }), { 'profile ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/account/notifications`, {
    ...authHeaders(data),
    tags: { name: 'account-notifications' },
  }), { 'notifications ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/offlinemap/bundle?minLat=52.45&minLng=-1.95&maxLat=52.52&maxLng=-1.88`, {
    ...authHeaders(data),
    tags: { name: 'offline-map-bundle' },
  }), { 'offline bundle ok': (r) => ok(r, [200]) });

  check(http.get(`${baseUrl}/api/v1/tiles/15/16204/10843.pbf`, {
    ...authHeaders(data),
    tags: { name: 'tile' },
  }), { 'tile ok': (r) => ok(r, [200, 204]) });
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const compact = {
    http_reqs_per_second: metrics.http_reqs?.values?.rate,
    http_req_failed_rate: metrics.http_req_failed?.values?.rate,
    frontend_api_failure_rate: metrics.frontend_api_failure?.values?.rate,
    checks_rate: metrics.checks?.values?.rate,
    http_req_duration_p95_ms: metrics.http_req_duration?.values?.['p(95)'],
    http_req_duration_p99_ms: metrics.http_req_duration?.values?.['p(99)'],
    route_end_to_end_p95_ms: metrics.route_end_to_end_ms?.values?.['p(95)'],
    route_job_timeout_rate: metrics.route_job_timeout?.values?.rate,
    dropped_iterations: metrics.dropped_iterations?.values?.count,
  };

  return {
    stdout: `${JSON.stringify(compact, null, 2)}\n`,
    '/tmp/accesscity-frontend-api-k6-summary.json': JSON.stringify(data, null, 2),
  };
}
