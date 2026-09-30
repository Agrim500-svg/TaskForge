import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";

export function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted page-description">{description}</p>}</div>{action && <div className="page-actions">{action}</div>}</div>;
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Avatar({ user, size = "normal" }) {
  const text = (user?.fullName || user?.username || "TF").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return user?.avatar?.url && user.avatar.url.includes("http") && !user.avatar.url.includes("placehold.co")
    ? <img className={`avatar avatar-${size}`} src={user.avatar.url} alt="" />
    : <span className={`avatar avatar-${size}`}>{text || "TF"}</span>;
}

export function Badge({ children, tone = "neutral" }) { return <span className={`badge badge-${tone}`}>{children}</span>; }

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state">{Icon && <span className="empty-icon"><Icon size={22} /></span>}<h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Loading({ label = "Loading your workspace" }) { return <div className="loading-state"><span className="spinner" /><span>{label}</span></div>; }

export function ErrorNotice({ error, onRetry }) {
  return <div className="error-notice"><div><strong>We couldn’t load this.</strong><p>{error?.message || "Check your connection and try again."}</p></div>{onRetry && <Button variant="quiet" onClick={onRetry}>Try again</Button>}</div>;
}

export function Modal({ title, children, onClose, wide = false }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

export function useToast() {
  const [toast, setToast] = useState("");
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const element = toast ? <div className="toast" role="status">{toast}</div> : null;
  return { showToast, toastElement: element };
}

export function Field({ label, hint, ...props }) {
  const id = props.id || props.name;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { as, ...fieldProps } = props;
  const isPassword = fieldProps.type === "password" || (fieldProps.type === "text" && props.revealPassword);
  if (props.revealPassword) delete fieldProps.revealPassword;
  return <div className="field"><label htmlFor={id}>{label}</label>{as === "textarea" ? <textarea id={id} {...fieldProps} /> : as === "select" ? <select id={id} {...fieldProps} /> : isPassword ? <span className="password-input-wrap"><input id={id} {...fieldProps} type={passwordVisible ? "text" : "password"} /><button type="button" className="password-toggle" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span> : <input id={id} {...fieldProps} />}{hint && <small>{hint}</small>}</div>;
}

export function formatDate(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function formatStatus(status) {
  if (status === "todo") return "Not started";
  if (status === "in_progress") return "In progress";
  return status === "done" ? "Done" : status || "Not started";
}

export function initials(user) { return (user?.fullName || user?.username || "TF").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
