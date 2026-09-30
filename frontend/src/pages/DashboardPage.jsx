import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCheck, CircleCheck, Clock3, FolderKanban, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageTitle, formatDate, formatStatus } from "../components/common.jsx";

export default function DashboardPage() {
  const { user } = useAuth(); const [data, setData] = useState({ projects: [], tasks: [] }); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const projects = await api("/project");
      const taskGroups = await Promise.all(projects.map(async (item) => ({ project: item.project, role: item.role, tasks: await api(`/tasks/${item.project._id}`) })));
      setData({ projects, tasks: taskGroups.flatMap((group) => group.tasks.map((task) => ({ ...task, project: group.project, projectRole: group.role }))) });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const openTasks = useMemo(() => data.tasks.filter((task) => task.status !== "done"), [data.tasks]);
  const mine = useMemo(() => openTasks.filter((task) => String(task.assignedTo?._id || task.assignedTo) === String(user?._id)), [openTasks, user]);
  const completed = data.tasks.filter((task) => task.status === "done").length;
  const latestTasks = [...openTasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  const displayTasks = latestTasks.length ? latestTasks : [...data.tasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  if (loading) return <Loading />;
  return <div className="page-stack">
    <PageTitle eyebrow="YOUR WORKSPACE" title={`${greeting}, ${user?.fullName?.split(" ")[0] || user?.username || "there"}.`} description="A clear view of the work moving forward." action={<Link to="/projects" className="button button-primary"><Plus size={16} />New project</Link>} />
    {error && <ErrorNotice error={{ message: error }} onRetry={load} />}
    <div className="stats-grid">
      <article className="stat-card"><span className="stat-icon"><FolderKanban size={19} /></span><div className="stat-label">Active projects</div><strong>{data.projects.length}</strong><span className="stat-foot">Across your workspace</span></article>
      <article className="stat-card"><span className="stat-icon"><Clock3 size={19} /></span><div className="stat-label">My open tasks</div><strong>{mine.length}</strong><span className="stat-foot">Assigned to you</span></article>
      <article className="stat-card"><span className="stat-icon"><CheckCheck size={19} /></span><div className="stat-label">Completed tasks</div><strong>{completed}</strong><span className="stat-foot">Good work adds up</span></article>
    </div>
    <div className="dashboard-columns">
      <section className="panel projects-panel"><div className="section-heading"><div><p className="eyebrow">WORKSPACES</p><h2>My projects</h2></div><Link className="text-link" to="/projects">View all <ArrowUpRight size={15} /></Link></div>
        {data.projects.length ? <div className="project-list">{data.projects.slice(0, 5).map(({ project, role }) => {
          const tasks = data.tasks.filter((task) => String(task.project._id) === String(project._id)); const percent = tasks.length ? Math.round(tasks.filter((task) => task.status === "done").length / tasks.length * 100) : 0;
          return <Link className="project-row" key={project._id} to={`/projects/${project._id}`}><span className="project-glyph"><FolderKanban size={18} /></span><span className="project-row-main"><strong>{project.name}</strong><span>{project.members || 1} members · {tasks.length} tasks</span><span className="progress-track"><i style={{ width: `${percent}%` }} /></span></span><span className="project-percent">{percent}%</span><Badge>{role?.replace("_", " ") || "member"}</Badge></Link>;
        })}</div> : <EmptyState icon={FolderKanban} title="Your first project starts here" description="Create a shared space for the work you want to move forward." action={<Link to="/projects" className="button button-primary"><Plus size={15} />Create a project</Link>} />}
      </section>
      <section className="panel tasks-panel"><div className="section-heading"><div><p className="eyebrow">NEXT UP</p><h2>{latestTasks.length ? "Open work" : data.tasks.length ? "Recently completed" : "Open work"}</h2></div><Link className="text-link" to="/tasks">All tasks <ArrowUpRight size={15} /></Link></div>
        {displayTasks.length ? <div className="task-preview-list">{displayTasks.map((task) => <Link className="task-preview" key={task._id} to={`/tasks/${task.project._id}/${task._id}`}><span className={`task-check ${task.status === "done" ? "checked" : ""}`}>{task.status === "done" && <CircleCheck size={16} />}</span><span className="task-preview-main"><strong>{task.title}</strong><span>{task.project.name}</span></span><Badge tone={task.status === "in_progress" ? "dark" : "neutral"}>{formatStatus(task.status)}</Badge></Link>)}</div> : <EmptyState icon={Sparkles} title="Nothing waiting on you" description="Create a task in a project and it will show up here." action={<Link className="text-link" to="/projects">Explore projects <ArrowUpRight size={15} /></Link>} />}
        {displayTasks.length > 0 && <div className="panel-note">{latestTasks.length ? "Showing your latest open work" : "All your current tasks are complete"} · Updated {formatDate(new Date())}</div>}
      </section>
    </div>
  </div>;
}
