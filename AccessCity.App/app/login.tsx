import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AntDesign, FontAwesome, Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useFormAnimation } from "@/hooks/use-form-animation";
import { authService } from "@/services/auth.service";
import { AppTheme } from "@/constants/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const { signIn } = useAuth();
  const { shake, shakeStyle } = useFormAnimation();

  const handleSocialLogin = (provider: string) => {
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
          `${provider} login`,
          error?.message || "OAuth is not configured for this build yet. Use email and password to sign in."
        );
      }
    })();
  };

  const handleLogin = async () => {
    await authService.clearSession();

    setErrorStatus(null);
    if (!email || !password) {
      setErrorStatus("All fields are mandatory");
      shake();
      return;
    }

    setIsAuthenticating(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/map");
    } catch (err: any) {
      setErrorStatus(err.message || "Invalid credentials. Please try again.");
      shake();
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
              <Ionicons name="chevron-back" size={24} color={AppTheme.color.text} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Enter your details to log in</Text>
            </View>

            <Animated.View style={shakeStyle}>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLogin("Google")}>
                <AntDesign name="google" size={24} color="#EA4335" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLogin("Facebook")}>
                <FontAwesome name="facebook" size={24} color={AppTheme.color.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialLogin("Apple")}>
                <AntDesign name="apple" size={24} color={AppTheme.color.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or login with email</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={AppTheme.color.textMuted} style={styles.inputIcon} />
                <TextInput
                  placeholder="Email Address"
                  placeholderTextColor={AppTheme.color.textSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={AppTheme.color.textMuted} style={styles.inputIcon} />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={AppTheme.color.textSubtle}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                />
              </View>

              <ErrorMessage visible={!!errorStatus} message={errorStatus ?? undefined} />

              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={() => router.push("/forgot-password")}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.85} 
                style={styles.mainButtonContainer}
                onPress={handleLogin}
                disabled={isAuthenticating}
              >
                <LinearGradient
                  colors={[AppTheme.color.primary, AppTheme.color.primaryDark]}
                  style={styles.mainButton}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color={AppTheme.color.textInverse} />
                  ) : (
                    <Text style={styles.mainButtonText}>Log In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={styles.footerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: AppTheme.layout.maxFormWidth,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: AppTheme.color.text,
    letterSpacing: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppTheme.color.textMuted,
    fontWeight: "500",
  },
  socialRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
  },
  socialButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: AppTheme.color.surface,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AppTheme.color.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: AppTheme.color.textSubtle,
    fontWeight: "600",
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: AppTheme.color.text,
    fontWeight: "600",
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginTop: -8,
  },
  forgotPasswordText: {
    color: AppTheme.color.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  mainButtonContainer: {
    marginTop: 12,
    borderRadius: AppTheme.radius.lg,
    shadowColor: AppTheme.color.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  mainButton: {
    height: 60,
    borderRadius: AppTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  mainButtonText: {
    color: AppTheme.color.textInverse,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 40,
  },
  footerText: {
    fontSize: 15,
    color: AppTheme.color.textMuted,
    fontWeight: "500",
  },
  footerLink: {
    fontSize: 15,
    color: AppTheme.color.primary,
    fontWeight: "700",
  },
});
