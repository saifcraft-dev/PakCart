export function MediaUpload(props: {
  onUploadComplete?: (files: any[]) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  folder?: string;
  multiple?: boolean;
  className?: string;
}): JSX.Element;
