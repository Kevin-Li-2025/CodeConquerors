#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${NAMESPACE:-accesscity}"
OVERLAY="${OVERLAY:-deploy/kubernetes-capacity}"
BASE_URL="${BASE_URL:-http://accesscity-api}"
TEST_DURATION="${TEST_DURATION:-10m}"
JOB_TIMEOUT="${JOB_TIMEOUT:-30m}"
APPLY_OVERLAY="${APPLY_OVERLAY:-true}"
LOCK_KEDA_REPLICAS="${LOCK_KEDA_REPLICAS:-true}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/tmp/accesscity-capacity-$(date -u +%Y%m%dT%H%M%SZ)}"
MATRIX="${MATRIX:-10:30:80:220:80:60:40:40:0 20:60:160:440:160:120:80:60:0}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

mkdir -p "$ARTIFACT_DIR"

log() {
  printf '[capacity] %s\n' "$*"
}

kubectl_ns() {
  kubectl -n "$NAMESPACE" "$@"
}

wait_for_ready_replicas() {
  local deploy="$1"
  local expected="$2"
  local ready

  for _ in $(seq 1 180); do
    ready="$(kubectl_ns get deploy "$deploy" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
    ready="${ready:-0}"
    if [ "$ready" -ge "$expected" ]; then
      log "$deploy ready replicas: $ready/$expected"
      return 0
    fi
    sleep 5
  done

  kubectl_ns get deploy "$deploy" -o wide || true
  kubectl_ns get pods -l "app=$deploy" -o wide || true
  printf 'Timed out waiting for %s ready replicas >= %s\n' "$deploy" "$expected" >&2
  return 1
}

patch_scaledobject_if_present() {
  local name="$1"
  local replicas="$2"

  if ! kubectl_ns get "scaledobject.keda.sh/$name" >/dev/null 2>&1; then
    log "KEDA ScaledObject $name not found; using Deployment scale only"
    return 0
  fi

  if [ "$LOCK_KEDA_REPLICAS" = "true" ]; then
    kubectl_ns patch "scaledobject.keda.sh/$name" --type merge \
      -p "{\"spec\":{\"minReplicaCount\":$replicas,\"maxReplicaCount\":$replicas,\"fallback\":{\"failureThreshold\":3,\"replicas\":$replicas}}}" >/dev/null
  else
    kubectl_ns patch "scaledobject.keda.sh/$name" --type merge \
      -p "{\"spec\":{\"minReplicaCount\":$replicas,\"fallback\":{\"failureThreshold\":3,\"replicas\":$replicas}}}" >/dev/null
  fi
}

snapshot_cluster() {
  local dir="$1"
  mkdir -p "$dir"
  kubectl_ns get deploy,pods,svc,pdb -o wide > "$dir/workloads.txt" || true
  kubectl_ns get scaledobject.keda.sh -o yaml > "$dir/keda-scaledobjects.yaml" 2>/dev/null || true
  kubectl_ns get configmap accesscity-api-config accesscity-worker-config -o yaml > "$dir/runtime-config.yaml" || true
  kubectl_ns top pods > "$dir/pod-top.txt" 2>/dev/null || true
  kubectl_ns get events --sort-by=.lastTimestamp > "$dir/events.txt" 2>/dev/null || true
}

run_capacity_job() {
  local api_replicas="$1"
  local worker_replicas="$2"
  local route_rate="$3"
  local risk_rate="$4"
  local poi_rate="$5"
  local hazard_rate="$6"
  local dashboard_rate="$7"
  local readiness_rate="$8"
  local tile_rate="$9"
  local run_name="api${api_replicas}-worker${worker_replicas}-route${route_rate}"
  local job_name="accesscity-capacity-${run_name}-$(date -u +%H%M%S)"
  local run_dir="$ARTIFACT_DIR/$run_name"

  mkdir -p "$run_dir"
  log "Running $run_name for $TEST_DURATION"

  kubectl_ns delete job -l app=accesscity-capacitytest --ignore-not-found >/dev/null
  kubectl_ns apply -f "$ROOT_DIR/deploy/kubernetes/capacitytest-configmap.yaml" >/dev/null

  cat <<YAML | kubectl_ns apply -f - >/dev/null
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  labels:
    app: accesscity-capacitytest
    accesscity.io/capacity-run: "$run_name"
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 7200
  template:
    metadata:
      labels:
        app: accesscity-capacitytest
        accesscity.io/capacity-run: "$run_name"
    spec:
      restartPolicy: Never
      containers:
        - name: k6
          image: grafana/k6:0.51.0
          imagePullPolicy: IfNotPresent
          command: ["k6", "run", "--summary-export=/results/k6-summary.json", "/scripts/accesscity-capacity.js"]
          env:
            - name: BASE_URL
              value: "$BASE_URL"
            - name: TEST_DURATION
              value: "$TEST_DURATION"
            - name: ROUTE_RATE
              value: "$route_rate"
            - name: RISK_RATE
              value: "$risk_rate"
            - name: POI_RATE
              value: "$poi_rate"
            - name: HAZARD_RATE
              value: "$hazard_rate"
            - name: DASHBOARD_RATE
              value: "$dashboard_rate"
            - name: READINESS_RATE
              value: "$readiness_rate"
            - name: TILE_RATE
              value: "$tile_rate"
            - name: ROUTE_POLL_TIMEOUT_SECONDS
              value: "25"
            - name: AUTH_TOKEN
              value: "$AUTH_TOKEN"
          resources:
            requests:
              cpu: "2"
              memory: "1Gi"
            limits:
              cpu: "6"
              memory: "2Gi"
          volumeMounts:
            - name: capacity-script
              mountPath: /scripts
              readOnly: true
            - name: results
              mountPath: /results
      volumes:
        - name: capacity-script
          configMap:
            name: accesscity-capacitytest-script
        - name: results
          emptyDir: {}
YAML

  if ! kubectl_ns wait --for=condition=complete "job/$job_name" --timeout="$JOB_TIMEOUT"; then
    kubectl_ns describe "job/$job_name" > "$run_dir/job-describe.txt" || true
    kubectl_ns logs "job/$job_name" --all-containers=true > "$run_dir/k6.log" 2>&1 || true
    snapshot_cluster "$run_dir/after-failure"
    printf 'Capacity test job failed or timed out: %s\n' "$job_name" >&2
    return 1
  fi

  kubectl_ns logs "job/$job_name" --all-containers=true > "$run_dir/k6.log"
  local pod
  pod="$(kubectl_ns get pods -l "job-name=$job_name" -o jsonpath='{.items[0].metadata.name}')"
  kubectl_ns exec "$pod" -- cat /results/k6-summary.json > "$run_dir/k6-summary.json" 2>/dev/null || true
  snapshot_cluster "$run_dir/after-success"

  if command -v jq >/dev/null 2>&1 && [ -s "$run_dir/k6-summary.json" ]; then
    jq -r '[
      .metrics.http_reqs.values.rate,
      .metrics.http_req_duration.values["p(95)"],
      .metrics.http_req_duration.values["p(99)"],
      (.metrics.route_critical_failures.values.rate // 0),
      (.metrics.route_job_timeouts.values.rate // 0),
      (.metrics.hot_read_failures.values.rate // 0)
    ] | @tsv' "$run_dir/k6-summary.json" > "$run_dir/summary.tsv"
  fi
}

cd "$ROOT_DIR"
log "Artifacts: $ARTIFACT_DIR"

kubectl cluster-info >/dev/null

if [ "$APPLY_OVERLAY" = "true" ]; then
  log "Applying capacity overlay: $OVERLAY"
  kubectl apply -k "$OVERLAY"
fi

kubectl_ns rollout status deploy/accesscity-api --timeout=10m
kubectl_ns rollout status deploy/accesscity-worker --timeout=10m

for row in $MATRIX; do
  IFS=':' read -r api_replicas worker_replicas route_rate risk_rate poi_rate hazard_rate dashboard_rate readiness_rate tile_rate <<EOF
$row
EOF
  tile_rate="${tile_rate:-0}"

  log "Preparing topology api=$api_replicas workers=$worker_replicas"
  patch_scaledobject_if_present accesscity-api-scalability "$api_replicas"
  patch_scaledobject_if_present accesscity-worker-kafka "$worker_replicas"
  kubectl_ns scale deploy/accesscity-api --replicas="$api_replicas"
  kubectl_ns scale deploy/accesscity-worker --replicas="$worker_replicas"
  kubectl_ns rollout status deploy/accesscity-api --timeout=10m
  kubectl_ns rollout status deploy/accesscity-worker --timeout=10m
  wait_for_ready_replicas accesscity-api "$api_replicas"
  wait_for_ready_replicas accesscity-worker "$worker_replicas"

  run_capacity_job \
    "$api_replicas" \
    "$worker_replicas" \
    "$route_rate" \
    "$risk_rate" \
    "$poi_rate" \
    "$hazard_rate" \
    "$dashboard_rate" \
    "$readiness_rate" \
    "$tile_rate"
done

if [ "$APPLY_OVERLAY" = "true" ] && [ "$LOCK_KEDA_REPLICAS" = "true" ]; then
  log "Restoring capacity overlay autoscaling bounds"
  kubectl apply -k "$OVERLAY" >/dev/null
fi

log "Capacity validation complete. Review $ARTIFACT_DIR"
