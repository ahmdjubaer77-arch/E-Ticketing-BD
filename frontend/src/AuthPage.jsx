import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Ticket,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import "./auth.css";
import { authRequest, getAuthErrorMessage } from "./authApi.js";

const initialValues = {
  fullName: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
};

export default function AuthPage({ initialMode = "login", onHome, onAuthenticated, onAuthError }) {
  const [mode, setMode] = useState(initialMode);
  const [flow, setFlow] = useState("form");
  const [values, setValues] = useState(initialValues);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setFlow("form");
    setErrors({});
    setNotice("");
    setNoticeType("success");
  }, [initialMode]);

  useEffect(() => {
    if (!countdown) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setFlow("form");
    setErrors({});
    setNotice("");
    setNoticeType("success");
    setOtp("");
    setResetToken("");
  }

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setNotice("");
    setNoticeType("success");
  }

  async function submitForm(event) {
    event.preventDefault();
    const nextErrors = {};
    if (mode === "register" && !values.fullName.trim()) {
      nextErrors.fullName = "Please enter your full name.";
    }
    if (!values.email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (mode === "register" && values.mobile.trim() && !/^\+?[0-9\s()-]{7,20}$/.test(values.mobile.trim())) {
      nextErrors.mobile = "Enter a valid mobile number.";
    }
    if (!values.password) {
      nextErrors.password = "Please enter your password.";
    } else if (mode === "register" && values.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }
    if (mode === "register" && values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (mode === "register" && !acceptedTerms) {
      nextErrors.terms = "Please agree to the terms to create an account.";
    }

    setErrors(nextErrors);
    setNotice("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      if (mode === "login") {
        const result = await authRequest("/login", {
          method: "POST",
          body: {
            email: values.email,
            password: values.password,
            rememberMe,
          },
        });
        onAuthenticated(result.data.user, "login");
        return;
      }

      const result = await authRequest("/register", {
        method: "POST",
        body: {
          fullName: values.fullName,
          email: values.email,
          phone: values.mobile.trim() ? `+880 ${values.mobile.trim()}` : "",
          password: values.password,
          confirmPassword: values.confirmPassword,
        },
      });
      setFlow("verify-email");
      setOtp("");
      setCountdown(result.data?.resendAfterSeconds || 60);
      setNotice(result.message);
    } catch (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setValues((current) => ({ ...current, email: error.data?.email || current.email }));
        setFlow("verify-email");
        setCountdown(0);
      }
      setErrors((current) => ({ ...current, ...error.errors }));
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      if (mode === "login") onAuthError?.(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmailOtp(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setErrors({ otp: "Enter the 6-digit code from your email." });
      return;
    }
    setBusy(true);
    setErrors({});
    setNotice("");
    try {
      const result = await authRequest("/verify-email", { method: "POST", body: { email: values.email, otp } });
      onAuthenticated(result.data.user, "verification");
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      setErrors(error.errors || {});
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (busy || countdown > 0) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await authRequest("/resend-otp", { method: "POST", body: { email: values.email } });
      setNotice(result.message);
      setNoticeType("success");
      setCountdown(result.data?.resendAfterSeconds || 60);
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      setCountdown(error.data?.retryAfterSeconds || 0);
    } finally {
      setBusy(false);
    }
  }

  async function resendPasswordOtp() {
    if (busy || countdown > 0) return;
    setBusy(true);
    setNotice("");
    try {
      await authRequest("/forgot-password", { method: "POST", body: { email: values.email } });
      setNotice("If an eligible account exists, a new reset code has been sent.");
      setNoticeType("success");
      setCountdown(60);
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      setCountdown(error.data?.retryAfterSeconds || 0);
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }
    setBusy(true);
    setErrors({});
    setNotice("");
    try {
      const result = await authRequest("/forgot-password", { method: "POST", body: { email: values.email } });
      setFlow("verify-reset");
      setOtp("");
      setCountdown(result.data?.resendAfterSeconds || 60);
      setNotice(result.message);
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      setCountdown(error.data?.retryAfterSeconds || 0);
    } finally {
      setBusy(false);
    }
  }

  async function submitResetOtp(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setErrors({ otp: "Enter the 6-digit code from your email." });
      return;
    }
    setBusy(true);
    setErrors({});
    setNotice("");
    try {
      const result = await authRequest("/verify-reset-otp", { method: "POST", body: { email: values.email, otp } });
      setResetToken(result.data.resetToken);
      setFlow("reset-password");
      setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
      setNotice(result.message);
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      setErrors(error.errors || {});
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(event) {
    event.preventDefault();
    const nextErrors = {};
    if (values.password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (!/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      nextErrors.password = "Use uppercase, lowercase, and numeric characters.";
    }
    if (values.password !== values.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    setNotice("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const result = await authRequest("/reset-password", {
        method: "POST",
        body: {
          resetToken,
          password: values.password,
          confirmPassword: values.confirmPassword,
        },
      });
      setFlow("form");
      setMode("login");
      setResetToken("");
      setValues((current) => ({ ...current, password: "", confirmPassword: "" }));
      setNotice(result.message);
      setNoticeType("success");
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setNoticeType("error");
      setErrors(error.errors || {});
    } finally {
      setBusy(false);
    }
  }

  async function showUnavailableMessage(label) {
    if (label === "Password recovery") {
      setFlow("forgot-email");
      setNotice("");
      setErrors({});
      return;
    }
    setNotice(`${label} is not configured.`);
  }

  const isRegister = mode === "register";
  const showingForm = flow === "form";
  const flowHeadings = {
    "verify-email": ["Verify your email", `We sent a 6-digit code to ${values.email}.`],
    "forgot-email": ["Forgot password?", "Enter your email and we’ll send a reset code if an account exists."],
    "verify-reset": ["Check your email", `Enter the password reset code sent to ${values.email}.`],
    "reset-password": ["Create a new password", "Choose a strong password for your account."],
  };
  const heading = flowHeadings[flow];

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Travel with E-Ticketing">
        <div className="auth-visual-copy">
          <span className="auth-brand-pill"><Ticket size={14} /> E-Ticketing System</span>
          <h1>{isRegister ? <>Your next journey<br />starts <span>here.</span></> : <>Your next journey<br />starts <span>here.</span></>}</h1>
          <p>Book bus, train, launch or event tickets online — fast, secure and hassle-free.</p>
        </div>
        <span className="auth-visual-caption">Every journey, a little easier.</span>
      </section>

      <div className="auth-form-wrap">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              <UserRound size={16} /> Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              <UserRoundPlus size={16} /> Sign Up
            </button>
          </div>

          <div className="auth-heading">
            <h2 id="auth-title">{heading?.[0] || (isRegister ? "Create your account" : "Welcome back")}</h2>
            <p>{heading?.[1] || (isRegister ? "Join us and make your next trip effortless." : "Login to your E-Ticketing account")}</p>
          </div>

          {showingForm && <form className="auth-form" onSubmit={submitForm} noValidate>
            {isRegister && (
              <label className="auth-field">
                <span>Full name</span>
                <span className={`auth-input-wrap${errors.fullName ? " has-error" : ""}`}>
                  <UserRound size={17} />
                  <input
                    autoComplete="name"
                    value={values.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder="Your full name"
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={errors.fullName ? "auth-fullName-error" : undefined}
                  />
                </span>
                {errors.fullName && <small id="auth-fullName-error">{errors.fullName}</small>}
              </label>
            )}

            <label className="auth-field">
              <span>Email address</span>
              <span className={`auth-input-wrap${errors.email ? " has-error" : ""}`}>
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "auth-email-error" : undefined}
                />
              </span>
              {errors.email && <small id="auth-email-error">{errors.email}</small>}
            </label>

            {isRegister && (
              <label className="auth-field">
                <span>Mobile number <small>Optional</small></span>
                <span className={`auth-input-wrap${errors.mobile ? " has-error" : ""}`}>
                  <span className="auth-phone-prefix">+880</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={values.mobile}
                    onChange={(event) => updateField("mobile", event.target.value)}
                    placeholder="1XXX-XXXXXX"
                    aria-invalid={Boolean(errors.mobile)}
                    aria-describedby={errors.mobile ? "auth-mobile-error" : undefined}
                  />
                </span>
                {errors.mobile && <small id="auth-mobile-error">{errors.mobile}</small>}
              </label>
            )}

            <label className="auth-field">
              <span>Password</span>
              <span className={`auth-input-wrap${errors.password ? " has-error" : ""}`}>
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={values.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "auth-password-error" : undefined}
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {errors.password && <small id="auth-password-error">{errors.password}</small>}
            </label>

            {isRegister && (
              <label className="auth-field">
                <span>Confirm password</span>
                <span className={`auth-input-wrap${errors.confirmPassword ? " has-error" : ""}`}>
                  <LockKeyhole size={17} />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    placeholder="Re-enter your password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "auth-confirmPassword-error" : undefined}
                  />
                </span>
                {errors.confirmPassword && <small id="auth-confirmPassword-error">{errors.confirmPassword}</small>}
              </label>
            )}

            {!isRegister ? (
              <div className="auth-form-options">
                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <button type="button" onClick={() => showUnavailableMessage("Password recovery")}>
                  Forgot password?
                </button>
              </div>
            ) : (
              <label className="auth-checkbox auth-terms">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => {
                    setAcceptedTerms(event.target.checked);
                    setErrors((current) => ({ ...current, terms: "" }));
                  }}
                />
                <span>I agree to the terms and privacy policy.</span>
              </label>
            )}
            {errors.terms && <small className="auth-form-error">{errors.terms}</small>}

            <button className="auth-submit-button" type="submit" disabled={busy}>
              {busy ? "Please wait…" : isRegister ? <><UserRoundPlus size={17} /> Create Account</> : <><ArrowRight size={17} /> Login</>}
            </button>
          </form>}

          {flow === "forgot-email" && (
            <form className="auth-form" onSubmit={requestPasswordReset} noValidate>
              <label className="auth-field">
                <span>Email address</span>
                <span className={`auth-input-wrap${errors.email ? " has-error" : ""}`}>
                  <Mail size={17} />
                  <input
                    type="email"
                    autoComplete="email"
                    value={values.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.email)}
                  />
                </span>
                {errors.email && <small>{errors.email}</small>}
              </label>
              <button className="auth-submit-button" type="submit" disabled={busy}>
                {busy ? "Please wait…" : "Send reset code"}
              </button>
              <button className="auth-secondary-action" type="button" onClick={() => changeMode("login")}>
                Back to Login
              </button>
            </form>
          )}

          {(flow === "verify-email" || flow === "verify-reset") && (
            <form
              className="auth-form"
              onSubmit={flow === "verify-email" ? submitEmailOtp : submitResetOtp}
              noValidate
            >
              <label className="auth-field">
                <span>6-digit verification code</span>
                <span className={`auth-input-wrap auth-otp-input${errors.otp ? " has-error" : ""}`}>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setErrors({});
                    }}
                    placeholder="000000"
                    aria-label="6-digit verification code"
                    aria-invalid={Boolean(errors.otp)}
                  />
                </span>
                {errors.otp && <small>{errors.otp}</small>}
              </label>
              <button className="auth-submit-button" type="submit" disabled={busy}>
                {busy ? "Verifying…" : flow === "verify-email" ? "Verify Email" : "Verify Code"}
              </button>
              <p className="auth-countdown">
                {countdown > 0 ? `You can request a new code in ${countdown}s.` : "Didn’t receive a code?"}
                <button
                  type="button"
                  disabled={busy || countdown > 0}
                  onClick={flow === "verify-email" ? resendOtp : resendPasswordOtp}
                >
                  {busy ? " Sending…" : " Resend code"}
                </button>
              </p>
              <button className="auth-secondary-action" type="button" onClick={() => changeMode("login")}>
                Back to Login
              </button>
            </form>
          )}

          {flow === "reset-password" && (
            <form className="auth-form" onSubmit={submitNewPassword} noValidate>
              <label className="auth-field">
                <span>New password</span>
                <span className={`auth-input-wrap${errors.password ? " has-error" : ""}`}>
                  <LockKeyhole size={17} />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={values.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    placeholder="At least 8 characters"
                    aria-invalid={Boolean(errors.password)}
                  />
                  <button className="auth-password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {errors.password && <small>{errors.password}</small>}
              </label>
              <label className="auth-field">
                <span>Confirm new password</span>
                <span className={`auth-input-wrap${errors.confirmPassword ? " has-error" : ""}`}>
                  <LockKeyhole size={17} />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    placeholder="Re-enter your password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                  />
                </span>
                {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
              </label>
              <button className="auth-submit-button" type="submit" disabled={busy}>
                {busy ? "Updating…" : "Reset Password"}
              </button>
            </form>
          )}

          {notice && <p className={`auth-notice ${noticeType}`} role={noticeType === "error" ? "alert" : "status"}>{notice}</p>}

          {showingForm && <><div className="auth-divider"><span />or continue with<span /></div>
          <div className="auth-social-buttons">
            <button type="button" aria-label="Continue with Google" onClick={() => showUnavailableMessage("Google sign in")}>
              <span className="google-g">G</span>
            </button>
            <button type="button" aria-label="Continue with Facebook" onClick={() => showUnavailableMessage("Facebook sign in")}>
              <span className="facebook-f">f</span>
            </button>
            <button type="button" aria-label="Continue with Apple" onClick={() => showUnavailableMessage("Apple sign in")}>
              <span className="apple-mark">●</span>
            </button>
          </div>

          <p className="auth-mode-switch">
            {isRegister ? "Already have an account?" : "New to E-Ticketing?"}
            <button type="button" onClick={() => changeMode(isRegister ? "login" : "register")}>
              {isRegister ? " Login" : " Create an account"}
            </button>
          </p>
          </>}
        </section>
      </div>

      <div className="auth-mobile-home">
        <button type="button" onClick={onHome}><ArrowRight size={15} /> Back to E-Ticketing</button>
      </div>
    </main>
  );
}
