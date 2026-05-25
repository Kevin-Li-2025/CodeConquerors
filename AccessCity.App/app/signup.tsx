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
import { AppTheme } from "@/constants/theme";
import { authService } from "@/services/auth.service";

export default function SignupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { signUp } = useAuth();
  const { shake, shakeStyle } = useFormAnimation();

  const handleSocialSignup = (provider: string) => {
    void (async () => {
      try {
        const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/signup`
          : 'accesscity://auth/callback';
        const response = await authService.createOAuthAuthorizeUrl(provider.toLowerCase(), redirectUri);
        const WebBrowser = await import('expo-web-browser');
        await WebBrowser.openBrowserAsync(response.authorizationUrl);
      } catch (error: any) {
        Alert.alert(
          `${provider} signup`,
          error?.message || "OAuth registration is not configured for this build yet. Use email and password to create an account."
        );
      }
    })();
  };

  const handleSignup = async () => {
    setValidationError(null);
    if (!firstName || !lastName || !email || !password) {
      setValidationError("Please fill in all mandatory fields");
      shake();
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      shake();
      return;
    }

    setIsProcessing(true);
    try {
      await signUp(email, password, `${firstName} ${lastName}`);
      router.replace("/(tabs)/map");
    } catch (err: any) {
      setValidationError(err.message || "Registration failed. Please try again.");
      shake();
    } finally {
      setIsProcessing(false);
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
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join AccessCity and navigate safely</Text>
            </View>

            <Animated.View style={shakeStyle}>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialSignup("Google")}>
                <AntDesign name="google" size={24} color="#EA4335" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialSignup("Facebook")}>
                <FontAwesome name="facebook" size={24} color={AppTheme.color.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleSocialSignup("Apple")}>
                <AntDesign name="apple" size={24} color={AppTheme.color.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or signup with email</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.form}>
              <View style={styles.nameRow}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <TextInput
                    placeholder="First Name"
                    placeholderTextColor={AppTheme.color.textSubtle}
                    value={firstName}
                    onChangeText={setFirstName}
                    style={styles.input}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <TextInput
                    placeholder="Last Name"
                    placeholderTextColor={AppTheme.color.textSubtle}
                    value={lastName}
                    onChangeText={setLastName}
                    style={styles.input}
                  />
                </View>
              </View>

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

              <View style={styles.inputContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color={AppTheme.color.textMuted} style={styles.inputIcon} />
                <TextInput
                  placeholder="Confirm Password"
                  placeholderTextColor={AppTheme.color.textSubtle}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                />
              </View>

              <ErrorMessage visible={!!validationError} message={validationError ?? undefined} />

              <TouchableOpacity 
                activeOpacity={0.85} 
                style={styles.mainButtonContainer}
                onPress={handleSignup}
                disabled={isProcessing}
              >
                <LinearGradient
                  colors={[AppTheme.color.primary, AppTheme.color.primaryDark]}
                  style={styles.mainButton}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={AppTheme.color.textInverse} />
                  ) : (
                    <Text style={styles.mainButtonText}>Sign Up</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={styles.footerLink}>Log In</Text>
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
    marginBottom: 32,
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
    marginBottom: 24,
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
    marginBottom: 24,
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
    gap: 16,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
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
  mainButtonContainer: {
    marginTop: 8,
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
    marginTop: 32,
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
