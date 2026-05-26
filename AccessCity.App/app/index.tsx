import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from "expo-linear-gradient";
import { AntDesign, FontAwesome, Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  withDelay,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useFormAnimation } from "@/hooks/use-form-animation";
import { AppTheme } from "@/constants/theme";

export default function AuthScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  
  const { signIn, signUp, isAuthenticated } = useAuth();
  const { shake, shakeStyle } = useFormAnimation();
  const contentOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-50);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/map");
    }
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    headerTranslateY.value = withSpring(0, { damping: 15 });
  }, [contentOpacity, headerTranslateY, isAuthenticated]);

  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [isSignup]);

  const handleSocialAuth = (provider: string) => {
    void (async () => {
      try {
        const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : 'accesscity://auth/callback';
        const response = await authService.createOAuthAuthorizeUrl(provider.toLowerCase(), redirectUri);
        const WebBrowser = await import('expo-web-browser');
        await WebBrowser.openBrowserAsync(response.authorizationUrl);
      } catch (error: any) {
        Alert.alert(
          `${provider} auth`,
          error?.message || "OAuth is not configured for this build yet. Use email and password to continue."
        );
      }
    })();
  };

  const handleContactSupport = () => {
    void Linking.openURL('mailto:support@accesscity.app?subject=AccessCity%20support').catch(() => {
      Alert.alert('Support', 'Sign in and open Profile > Help & Support to send a request.');
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccessMsg(null);

    if (isForgot) {
      if (!email) {
        setError("Please enter your email address");
        shake();
        return;
      }
      setIsSubmitting(true);
      try {
        await authService.forgotPassword(email);
        setSuccessMsg("If your email is registered, you will receive a reset token.");
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email || !password || (isSignup && !fullName)) {
      setError("Please fill in all mandatory fields");
      shake();
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignup) {
        await signUp(email, password, fullName);
      } else {
        await signIn(email, password);
      }
      router.replace("/(tabs)/map");
    } catch (err: any) {
      setError(err.message || "Failed to authenticate. Please try again.");
      shake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const animatedHeaderStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: headerTranslateY.value }],
    };
  });

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: interpolate(contentOpacity.value, [0, 1], [20, 0]) }],
    };
  });

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.header, animatedHeaderStyle]}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/images/logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <View style={styles.logoGlow} />
              </View>
              <Text style={styles.title}>
                Access<Text style={styles.cityText}>City</Text>
              </Text>
              <Text style={styles.subtitle}>
                Navigate your world with confidence
              </Text>
            </Animated.View>

            <Animated.View style={[styles.authCard, animatedCardStyle, shakeStyle]}>
              {!isForgot ? (
                <>
                  <View style={styles.tabContainer}>
                    <Pressable
                      testID="index-auth-login-tab"
                      style={[styles.tab, !isSignup && styles.tabActive]}
                      onPress={() => setIsSignup(false)}
                    >
                      <Text style={[styles.tabText, !isSignup && styles.tabTextActive]}>Log In</Text>
                    </Pressable>
                    <Pressable
                      testID="index-auth-signup-tab"
                      style={[styles.tab, isSignup && styles.tabActive]}
                      onPress={() => setIsSignup(true)}
                    >
                      <Text style={[styles.tabText, isSignup && styles.tabTextActive]}>Sign Up</Text>
                    </Pressable>
                  </View>

                  <View style={styles.form}>
                    {isSignup && (
                      <View style={styles.fieldGroup}>
                        <Text style={styles.inputLabel}>Full name</Text>
                        <View style={[styles.inputWrapper, isNameFocused && styles.inputWrapperFocused]}>
                          <Ionicons name="person-outline" size={20} color={isNameFocused ? AppTheme.color.primary : AppTheme.color.textMuted} />
                          <TextInput
                            placeholder="Full Name"
                            placeholderTextColor={AppTheme.color.textSubtle}
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            onFocus={() => setIsNameFocused(true)}
                            onBlur={() => setIsNameFocused(false)}
                          />
                        </View>
                      </View>
                    )}

                    <View style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>Email address</Text>
                      <View style={[styles.inputWrapper, isEmailFocused && styles.inputWrapperFocused]}>
                        <Ionicons name="mail-outline" size={20} color={isEmailFocused ? AppTheme.color.primary : AppTheme.color.textMuted} />
                        <TextInput
                          placeholder="Email Address"
                          placeholderTextColor={AppTheme.color.textSubtle}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          onFocus={() => setIsEmailFocused(true)}
                          onBlur={() => setIsEmailFocused(false)}
                        />
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>Password</Text>
                      <View style={[styles.inputWrapper, isPasswordFocused && styles.inputWrapperFocused]}>
                        <Ionicons name="lock-closed-outline" size={20} color={isPasswordFocused ? AppTheme.color.primary : AppTheme.color.textMuted} />
                        <TextInput
                          placeholder="Password"
                          placeholderTextColor={AppTheme.color.textSubtle}
                          secureTextEntry
                          style={styles.input}
                          value={password}
                          onChangeText={setPassword}
                          onFocus={() => setIsPasswordFocused(true)}
                          onBlur={() => setIsPasswordFocused(false)}
                        />
                      </View>
                    </View>

                    <ErrorMessage visible={!!error} message={error ?? undefined} />

                    <TouchableOpacity 
                      onPress={() => {
                        setIsForgot(true);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      style={styles.forgotBtn}
                    >
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="index-auth-submit"
                      activeOpacity={0.8}
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                      style={styles.mainBtnContainer}
                    >
                      <LinearGradient
                        colors={[AppTheme.color.primary, AppTheme.color.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.mainBtn}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color={AppTheme.color.textInverse} />
                        ) : (
                          <>
                            <Text style={styles.mainBtnText}>
                              {isSignup ? "Create Account" : "Sign In"}
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color={AppTheme.color.textInverse} style={{ marginLeft: 6 }} />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.divider}>
                      <View style={styles.line} />
                      <Text style={styles.dividerText}>OR</Text>
                      <View style={styles.line} />
                    </View>

                    <View style={styles.socialRow}>
                      <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialAuth("Google")}>
                        <AntDesign name="google" size={22} color="#EA4335" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialAuth("Apple")}>
                        <FontAwesome name="apple" size={24} color={AppTheme.color.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.form}>
                  <Text style={styles.forgotHeaderTitle}>Reset Password</Text>
                  <Text style={styles.forgotSubtitle}>
                    Enter your email address and we&apos;ll send you a token to
                    reset your password.
                  </Text>
                  
                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>Email address</Text>
                    <View style={[styles.inputWrapper, isEmailFocused && styles.inputWrapperFocused]}>
                      <Ionicons name="mail-outline" size={20} color={isEmailFocused ? AppTheme.color.primary : AppTheme.color.textMuted} />
                      <TextInput
                        placeholder="Email Address"
                        placeholderTextColor={AppTheme.color.textSubtle}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setIsEmailFocused(true)}
                        onBlur={() => setIsEmailFocused(false)}
                      />
                    </View>
                  </View>

                  {successMsg && (
                    <View style={styles.successContainer}>
                      <Ionicons name="checkmark-circle" size={18} color={AppTheme.color.accent} />
                      <Text style={styles.successText}>{successMsg}</Text>
                    </View>
                  )}

                  <ErrorMessage visible={!!error} message={error ?? undefined} />

                  <TouchableOpacity 
                    activeOpacity={0.8} 
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    style={styles.mainBtnContainer}
                  >
                    <LinearGradient
                      colors={[AppTheme.color.primary, AppTheme.color.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.mainBtn}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color={AppTheme.color.textInverse} />
                      ) : (
                        <Text style={styles.mainBtnText}>Send Reset Link</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => {
                      setIsForgot(false);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    style={styles.backBtn}
                  >
                    <Ionicons name="arrow-back" size={16} color={AppTheme.color.textMuted} />
                    <Text style={styles.backBtnText}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>Need help? </Text>
              <TouchableOpacity accessibilityRole="link" onPress={handleContactSupport}>
                <Text style={styles.footerLink}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    width: "100%",
    maxWidth: AppTheme.layout.maxFormWidth,
    marginTop: 36,
    marginBottom: 24,
  },
  logoContainer: {
    position: "relative",
    marginBottom: 16,
  },
  logo: {
    width: 80,
    height: 80,
    zIndex: 2,
  },
  logoGlow: {
    position: "absolute",
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    backgroundColor: AppTheme.color.primarySoft,
    borderRadius: 40,
    opacity: 1,
    transform: [{ scale: 1.3 }],
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: AppTheme.color.text,
    letterSpacing: 0,
  },
  cityText: {
    color: AppTheme.color.primary,
  },
  subtitle: {
    fontSize: 15,
    color: AppTheme.color.textMuted,
    marginTop: 6,
    fontWeight: "500",
    textAlign: "center",
  },
  authCard: {
    width: "100%",
    maxWidth: AppTheme.layout.maxFormWidth,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    padding: 24,
    shadowColor: AppTheme.color.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.md,
    padding: 4,
    marginBottom: 24,
    position: "relative",
  },
  tab: {
    flex: 1,
    minHeight: AppTheme.layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    borderRadius: AppTheme.radius.sm,
  },
  tabActive: {
    backgroundColor: AppTheme.color.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: AppTheme.color.textMuted,
  },
  tabTextActive: {
    color: AppTheme.color.textInverse,
  },
  form: {
    gap: 14,
  },
  forgotHeaderTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: AppTheme.color.text,
    marginBottom: 8,
  },
  forgotSubtitle: {
    fontSize: 14,
    color: AppTheme.color.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  fieldGroup: {
    gap: 8,
  },
  inputLabel: {
    color: AppTheme.color.text,
    fontSize: 13,
    fontWeight: "700",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputWrapperFocused: {
    borderColor: AppTheme.color.primary,
    backgroundColor: AppTheme.color.surface,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: AppTheme.color.text,
    fontWeight: "500",
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -2,
  },
  forgotText: {
    color: AppTheme.color.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  mainBtnContainer: {
    marginTop: 8,
    borderRadius: AppTheme.radius.md,
    overflow: "hidden",
  },
  mainBtn: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtnText: {
    color: AppTheme.color.surface,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  backBtnText: {
    color: AppTheme.color.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppTheme.color.accentSoft,
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
  },
  successText: {
    flex: 1,
    color: AppTheme.color.accent,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: AppTheme.color.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: AppTheme.color.textSubtle,
    fontWeight: "800",
    letterSpacing: 0,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: AppTheme.color.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  footerLink: {
    color: AppTheme.color.primary,
    fontWeight: "700",
  },
});
