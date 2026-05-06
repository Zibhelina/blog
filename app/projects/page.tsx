import type { Metadata } from "next";
import { getAllProjects } from "@/lib/content";

export const metadata: Metadata = {
  title: "Projects",
  description: "Projects from João/Mqx."
};

export default async function ProjectsPage() {
  const projects = await getAllProjects();

  return (
    <>
      <header className="page-header">
        <h1>Projects</h1>
        <p>A short list of things in progress or worth noting.</p>
      </header>

      <ul className="entry-list">
        {projects.map((project) => (
          <li className="entry" key={project.slug}>
            <h2>{project.title}</h2>
            {project.status ? <div className="entry-meta">{project.status}</div> : null}
            <p>{project.description}</p>
            {project.stack.length > 0 ? <p className="project-stack">{project.stack.join(", ")}</p> : null}
            {project.url || project.repo ? (
              <div className="project-links">
                {project.url ? <a href={project.url}>Site</a> : null}
                {project.repo ? <a href={project.repo}>Source</a> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
