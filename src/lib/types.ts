export type JobSource = "onlinejobs" | "indeed" | "jobstreet" | "other";

export type JobStatus = "saved" | "applied" | "replied" | "closed";

export type JobTag = "wordpress" | "web-developer" | "fullstack" | "other";

export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  source: JobSource;
  tags: JobTag[];
  status: JobStatus;
  notes: string;
  createdAt: string;
  appliedAt?: string;
}

export interface AppData {
  coverLetter: string;
  jobs: Job[];
}
