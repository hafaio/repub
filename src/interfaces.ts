export interface Summarized {
  content: string;
  title: string;
  byline: string;
}

export interface SummarizedMessage extends Summarized {
  status: "success";
}

export interface SummarizedError {
  status: "error";
  content: string;
}

export interface ReadabilityOptions {
  charThreshold: number;
}
