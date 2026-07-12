"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type ProjectContextValue = {
  projects: Project[];
  project?: Project;
  projectId?: string;
  loading: boolean;
  setProjectId(id: string): void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);
const STORAGE_KEY = "logmind_project_id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string>(() =>
    typeof window === "undefined"
      ? ""
      : (localStorage.getItem(STORAGE_KEY) ?? ""),
  );
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
  const projects = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data],
  );

  const projectId = projects.some((item) => item.id === selected)
    ? selected
    : projects[0]?.id;

  function setProjectId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setSelected(id);
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        project: projects.find((item) => item.id === projectId),
        projectId,
        loading: projectsQuery.isLoading,
        setProjectId,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject must be used within ProjectProvider");
  return value;
}

export function ProjectPicker() {
  const { projects, projectId, setProjectId } = useProject();
  return (
    <div className="flex min-w-0 items-center gap-2">
      {projects.length > 0 && (
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger aria-label="Active project" className="w-44 sm:w-56">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      <CreateProjectDialog compact={projects.length > 0} />
    </div>
  );
}

export function CreateProjectDialog({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { setProjectId } = useProject();
  const mutation = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setProjectId(project.id);
      setOpen(false);
      toast.success("Project created");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={compact ? "icon" : "default"}
          variant={compact ? "outline" : "default"}
          title="Create project"
        >
          <PlusIcon data-icon={compact ? undefined : "inline-start"} />
          {!compact && "Create project"}
          <span className="sr-only">Create project</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            mutation.mutate({
              name: String(data.get("name")),
              description: String(data.get("description") || "") || undefined,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Group services, logs, and incidents under one project.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-5">
            <Field>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input id="project-name" name="name" required minLength={2} />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-description">Description</FieldLabel>
              <Input id="project-description" name="description" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
