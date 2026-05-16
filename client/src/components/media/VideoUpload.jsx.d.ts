export function VideoUpload(props: {
  onUploadComplete?: (data: { secure_url: string }) => void;
  userId?: string;
  folder?: string;
  value?: string;
}): JSX.Element;
