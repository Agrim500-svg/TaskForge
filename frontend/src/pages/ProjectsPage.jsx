import { useEffect, useState } from "react";
import { ArrowUpRight, FolderKanban, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { api, json } from "../lib/api.js";
import { Badge, Button, EmptyState, ErrorNotice, Field, Loading, Modal, PageTitle, useToast } from "../components/common.jsx";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [modal, setModal] = useState(false); const [form, setForm] = useState({ name: "", description: "" }); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState(""); const { showToast, toastElement } = useToast();
  async function load() { setLoading(true); setError(""); try { setProjects(await api("/project")); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function createProject(event) { event.preventDefault(); setBusy(true); setFormError(""); try { await api("/project", json("POST", form)); setModal(false); setForm({ name: "", description: "" }); await load(); showToast("Project created."); } catch (err) { setFormError(err.message); } finally { setBusy(false); } }
  const visible = projects.filter(({ project }) => `${project.name} ${project.description || ""}`.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <Loading />;
  return <div className="page-stack"><PageTitle eyebrow="YOUR WORKSPACE" title="Projects" description="Every project has a home. Find yours here." action={<Button onClick={() => setModal(true)}><Plus size={16} />New project</Button>} />{error && <ErrorNotice error={{ message: error }} onRetry={load} />}
    <div className="toolbar"><div className="filter-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project" /></div><span className="toolbar-count">{visible.length} {visible.length === 1 ? "project" : "projects"}</span></div>
    {visible.length ? <div className="project-card-grid">{visible.map(({ project, role }) => <Link to={`/projects/${project._id}`} className="project-card" key={project._id}><div className="project-card-top"><span className="project-glyph"><FolderKanban size={19} /></span><Badge>{role?.replace("_", " ")}</Badge></div><h2>{project.name}</h2><p>{project.description || "A shared space for the work ahead."}</p><div className="project-card-bottom"><span>{project.members || 1} team members</span><span className="text-link">Open project <ArrowUpRight size={15} /></span></div></Link>)}</div> : <EmptyState icon={FolderKanban} title={search ? "No matching projects" : "No projects yet"} description={search ? "Try another name or clear the search." : "Create your first project and give the team a place to get started."} action={!search && <Button onClick={() => setModal(true)}><Plus size={15} />Create a project</Button>} />}
    {modal && <Modal title="Create a project" onClose={() => setModal(false)}><form className="form-stack" onSubmit={createProject}><Field label="Project name" name="name" required maxLength={100} autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Website refresh" /><Field as="textarea" label="Description" name="description" maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What are you working on together?" rows={4} /><ErrorText error={formError} /><div className="modal-actions"><Button type="button" variant="quiet" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create project"}</Button></div></form></Modal>}{toastElement}</div>;
}

function ErrorText({ error }) { return error ? <p className="form-error" role="alert">{error}</p> : null; }
