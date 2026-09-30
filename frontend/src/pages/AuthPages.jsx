import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, FolderKanban, LockKeyhole, Moon, Sparkles, Sun } from "lucide-react";
import { api, json } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Button, Field } from "../components/common.jsx";

// Keep creator profile and contact links configurable in one place.
const LANDING_CONTACT_LINKS = {
  github: "https://github.com/Agrim500-svg",
  linkedin: "https://www.linkedin.com/in/agrim-karmakar",
  email: "mailto:agrimkarmakar500@gmail.com",
};

function AuthFrame({ eyebrow = "TASKFORGE WORKSPACE", title, description, children, footer }) {
  return <div className="auth-page"><div className="auth-backdrop" /><div className="auth-writing" aria-hidden="true"><span>PLAN WITH PURPOSE</span><span>MAKE PROGRESS</span><span>BUILD TOGETHER</span></div><Link to="/" className="auth-brand"><span className="brand-mark"><FolderKanban size={21} /></span>TaskForge</Link><div className="auth-card"><div className="auth-card-head"><span className="auth-icon"><LockKeyhole size={19} /></span><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{children}{footer && <div className="auth-footer">{footer}</div>}</div><p className="auth-bottom-note">Thoughtful work starts with a clear plan.</p></div>;
}

export function WelcomePage() {
  const { user, loading } = useAuth();
  const [dark, setDark] = useState(() => (localStorage.getItem("taskforge-theme") || "light") === "dark");
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("taskforge-theme", next ? "dark" : "light");
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }
  if (loading) return <div className="auth-page"><div className="auth-backdrop" /><p>Opening TaskForge…</p></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <div className="welcome-page"><div className="auth-backdrop" /><header className="welcome-header"><Link to="/" className="auth-brand"><span className="brand-mark"><FolderKanban size={21} /></span>TaskForge</Link><span className="welcome-header-note">A calmer place to get work done</span></header><main className="welcome-content"><div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={14} /> YOUR WORK, IN GOOD ORDER</span><h1>Make space for<br />meaningful progress.</h1><p>Bring projects, tasks, and teammates together in one clear workspace.</p><div className="welcome-actions"><Link to="/register" className="button button-primary">Create your account <ArrowRight size={16} /></Link><Link to="/login" className="button button-secondary">Sign in</Link></div><small>Simple project planning. One step at a time.</small></div><div className="welcome-art" aria-hidden="true"><div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" /><div className="welcome-note note-top"><span className="note-mark">✓</span><span><strong>Project momentum</strong><small>One task at a time</small></span></div><div className="welcome-note note-bottom"><span className="note-bars">▮▮▮</span><span><strong>Team in sync</strong><small>Progress, made visible</small></span></div><div className="welcome-center"><FolderKanban size={43} strokeWidth={1.3} /></div><span className="welcome-art-word">TASKFORGE</span></div></main><footer className="welcome-footer">
    <div className="welcome-footer-main">
      <section className="welcome-footer-brand"><strong>TaskForge</strong><p>Project management made simple for teams.</p></section>
      <section className="welcome-footer-creator"><span className="welcome-footer-label">Created by</span><strong>Agrim Karmakar</strong><span>Integrated M.Tech — CSE(Computational & Data Science)</span><span>VIT Bhopal University</span></section>
      <section className="welcome-footer-connect"><span className="welcome-footer-label">Connect</span><div className="welcome-footer-links"><a href={LANDING_CONTACT_LINKS.github} target="_blank" rel="noreferrer">GitHub</a><a href={LANDING_CONTACT_LINKS.linkedin} target="_blank" rel="noreferrer">LinkedIn</a><a href={LANDING_CONTACT_LINKS.email}>Email</a></div><button type="button" className={`theme-switch welcome-theme-switch ${dark ? "is-on" : ""}`} role="switch" aria-checked={dark} aria-label={`Switch to ${dark ? "light" : "dark"} theme`} onClick={toggleTheme}><span>{dark ? <Moon size={14} /> : <Sun size={14} />}</span><span>{dark ? "Dark theme" : "Light theme"}</span></button></section>
    </div>
    <div className="welcome-footer-bottom"><span>© 2026 TaskForge · Built by Agrim Karmakar</span></div>
  </footer></div>;
}

function AuthError({ error }) { return error ? <div className="form-error" role="alert">{error}</div> : null; }

export function LoginPage() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await signIn({ email: form.identifier.includes("@") ? form.identifier : undefined, username: form.identifier.includes("@") ? undefined : form.identifier, password: form.password }); navigate("/dashboard", { replace: true }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <AuthFrame title="Welcome back" description="Sign in to pick up where your team left off." footer={<>New to TaskForge? <Link to="/register">Create an account <ArrowRight size={14} /></Link></>}><form onSubmit={submit} className="form-stack"><Field label="Email or username" name="identifier" value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} autoComplete="username" required placeholder="you@example.com" /><Field label="Password" name="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" required placeholder="Enter your password" /><div className="form-inline"><span /> <Link to="/forgot-password">Forgot password?</Link></div><AuthError error={error} /><Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></Button></form></AuthFrame>;
}

export function RegisterPage() {
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "" });
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setError(""); setBusy(true); try { await api("/auth/register", json("POST", form)); setDone(true); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <AuthFrame title={done ? "Check your inbox" : "Create your workspace"} description={done ? "We sent a verification link to your email. Follow it to activate your account." : "Bring your projects and people together in one calm place."} footer={!done && <>Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    {done ? <div className="success-panel"><span className="success-icon"><Check size={21} /></span><p>Once your email is verified, come back here to sign in.</p><Link className="text-link" to="/login">Back to sign in</Link></div> : <form onSubmit={submit} className="form-stack"><Field label="Full name" name="fullName" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Your name" /><Field label="Username" name="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} required minLength={3} placeholder="yourname" /><Field label="Email" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required placeholder="you@example.com" /><Field label="Password" name="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={12} placeholder="At least 12 characters" /><AuthError error={error} /><Button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}<ArrowRight size={16} /></Button></form>}
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setError(""); setBusy(true); try { await api("/auth/forgot-password", json("POST", { email })); setDone(true); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <AuthFrame title={done ? "Check your inbox" : "Reset your password"} description={done ? "If an account uses that email, you’ll receive a reset link shortly." : "Enter the email associated with your account."} footer={<Link to="/login"><ArrowLeft size={14} /> Back to sign in</Link>}>{!done && <form onSubmit={submit} className="form-stack"><Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /><AuthError error={error} /><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}<ArrowRight size={16} /></Button></form>}</AuthFrame>;
}

export function ResetPasswordPage() {
  const { token } = useParams(); const navigate = useNavigate(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setError(""); setBusy(true); try { await api(`/auth/reset-password/${encodeURIComponent(token)}`, json("POST", { newPassword: password })); navigate("/login", { replace: true, state: { message: "Your password was changed. Sign in with the new one." } }); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <AuthFrame title="Choose a new password" description="Use at least 12 characters. You’ll need to sign in again after resetting it."><form onSubmit={submit} className="form-stack"><Field label="New password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} placeholder="At least 12 characters" /><AuthError error={error} /><Button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}<ArrowRight size={16} /></Button></form></AuthFrame>;
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams(); const token = searchParams.get("token"); const [status, setStatus] = useState(token ? "working" : "missing"); const [error, setError] = useState(""); const [email, setEmail] = useState(""); const [resendBusy, setResendBusy] = useState(false); const [resendMessage, setResendMessage] = useState(""); const [resendError, setResendError] = useState("");
  useEffect(() => { if (!token) return; api(`/auth/verify-email/${encodeURIComponent(token)}`).then(() => setStatus("done")).catch((err) => { setError(err.message); setStatus("error"); }); }, [token]);
  async function requestNewLink(event) { event.preventDefault(); setResendBusy(true); setResendError(""); setResendMessage(""); try { const result = await api("/auth/request-email-verification", json("POST", { email })); setResendMessage(result?.message || "If that account needs verification, a new link will be sent shortly."); } catch (err) { setResendError(err.message); } finally { setResendBusy(false); } }
  const needsNewLink = status === "error" || status === "missing";
  return <AuthFrame title={status === "done" ? "You’re all set!" : status === "working" ? "Verifying your email" : "Verify your email"} description={status === "done" ? "Your TaskForge account has been verified successfully." : status === "working" ? "This should only take a moment." : error || "This link may have expired or already been used. Request a fresh link below."} footer={status === "done" ? <Link to="/login" className="button button-primary">Continue to TaskForge <ArrowRight size={16} /></Link> : <Link to="/login">Go to sign in <ArrowRight size={14} /></Link>}>{status === "done" && <div className="verification-success"><span className="verification-check"><Check size={26} /></span><strong>Welcome to your workspace.</strong><span>Your email is confirmed and your account is ready.</span><Link to="/" className="text-link">Visit the TaskForge home page</Link></div>}{needsNewLink && <form className="form-stack resend-verification-form" onSubmit={requestNewLink}><Field label="Email used to register" name="verificationEmail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /><AuthError error={resendError} />{resendMessage && <p className="success-message" role="status">{resendMessage}</p>}<Button type="submit" variant="secondary" disabled={resendBusy}>{resendBusy ? "Requesting…" : "Send a fresh verification link"}</Button><p className="muted resend-hint">Use the newest message in your inbox. Requests are limited to one link per minute; for local testing, check Mailtrap.</p></form>}</AuthFrame>;
}
