import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { router } from "expo-router";
import { authService } from "@/services/auth.service";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useFormAnimation } from "@/hooks/use-form-animation";
import { AppTheme } from "@/constants/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorStatus, setErrorStatus] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const { shake, shakeStyle } = useFormAnimation();

  const handleRequestReset = async () => {
    if (!email || !email.includes("@")) {
      setErrorStatus({ message: "Please enter a valid email address.", visible: true });
      shake();
      return;
    }

    setIsSubmitting(true);
    setErrorStatus({ message: "", visible: false });

    try {
      await authService.forgotPassword(email);
      setIsSuccess(true);
    } catch (error: any) {
      setErrorStatus({ 
        message: error.message || "Failed to request reset. Please try again.", 
        visible: true 
      });
      shake();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContent}>
          <Ionicons name="mail-unread-outline" size={80} color={AppTheme.color.primary} />
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successText}>
            If an account exists for {email}, we&apos;ve sent a password reset
            token.
          </Text>
          <TouchableOpacity 
            style={styles.mainButton} 
            onPress={() => router.push("/reset-password" as any)}
          >
            <Text style={styles.mainButtonText}>Enter Token</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity 
            style={styles.headerBack} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={AppTheme.color.text} />
          </TouchableOpacity>

          <View style={styles.content}>
            <Animated.View entering={FadeInUp.duration(600).delay(200)}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we&apos;ll send you a token to
                reset your password.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.formCard, shakeStyle]}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={AppTheme.color.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <ErrorMessage message={errorStatus.message} visible={errorStatus.visible} />
              </View>

              <TouchableOpacity 
                activeOpacity={0.85} 
                style={styles.mainButtonContainer}
                onPress={handleRequestReset}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={[AppTheme.color.primary, AppTheme.color.primaryDark]}
                  style={styles.mainButton}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={AppTheme.color.textInverse} />
                  ) : (
                    <Text style={styles.mainButtonText}>Send Reset Link</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBack: {
    padding: 20,
    marginTop: Platform.OS === "android" ? 40 : 10,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    color: AppTheme.color.text,
    marginBottom: 8,
    ...AppTheme.type.screenTitle,
  },
  subtitle: {
    color: AppTheme.color.textMuted,
    marginBottom: 32,
    ...AppTheme.type.body,
  },
  formCard: {
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    padding: AppTheme.space.xl,
    ...AppTheme.shadow.card,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: AppTheme.color.textMuted,
    marginBottom: 8,
    marginLeft: 4,
    ...AppTheme.type.meta,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppTheme.color.surfaceSubtle,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },
  mainButtonContainer: {
    marginTop: 8,
  },
  mainButton: {
    height: 56,
    borderRadius: AppTheme.radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  mainButtonText: {
    color: AppTheme.color.textInverse,
    ...AppTheme.type.cardTitle,
  },
  successContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  successTitle: {
    color: AppTheme.color.text,
    marginTop: 24,
    marginBottom: 12,
    ...AppTheme.type.headline,
  },
  successText: {
    color: AppTheme.color.textMuted,
    textAlign: "center",
    marginBottom: 32,
    ...AppTheme.type.body,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
  },
  backButtonText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.body,
  },
});
