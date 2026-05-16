import { useState, useRef, useEffect } from "react";
import { uploadFile } from "@/services/cloudinaryService";
import { saveMediaMetadata } from "@/services/mediaMetadataService";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, Upload, CheckCircle, Video as VideoIcon } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export function VideoUpload({ onUploadComplete, userId: propUserId, folder = "videos", value }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(value ? { secure_url: value } : null);
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const { user } = useAuthStore();
  const userId = propUserId || user?.uid;

  // Update result if value changes externally
  useEffect(() => {
    if (value && (!result || result.secure_url !== value)) {
      setResult({ secure_url: value });
    } else if (!value) {
      setResult(null);
    }
  }, [value]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith("video/")) {
        toast({
          title: "Invalid file type",
          description: "Please select a video file (MP4, MOV, AVI, etc.)",
          variant: "destructive",
        });
        return;
      }
      // 100MB limit for videos as a reasonable default
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Video size must be less than 100MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      // 1. Upload to Cloudinary
      const cloudinaryData = await uploadFile(file, folder, (pct) => {
        setProgress(pct);
      });

      // 2. Save Metadata to Firestore
      const metadata = {
        title: file.name,
        type: "video",
        originalName: file.name,
      };
      
      const docId = await saveMediaMetadata(userId, cloudinaryData, metadata);
      
      const finalData = { ...cloudinaryData, firestoreId: docId };
      setResult(finalData);
      
      toast({
        title: "Video uploaded",
        description: "Your video has been processed successfully.",
      });

      if (onUploadComplete) {
        onUploadComplete(finalData);
      }
    } catch (error) {
      console.error("Video upload failed:", error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during video upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 w-full max-w-2xl mx-auto border-dashed border-2 flex flex-col items-center gap-4">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
      />

      {!file && !result && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-2 cursor-pointer py-8"
        >
          <div className="p-4 bg-primary/10 rounded-full">
            <VideoIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm font-medium">Click to select a video</p>
          <p className="text-xs text-muted-foreground">MP4, MOV, AVI up to 100MB</p>
        </div>
      )}

      {file && !result && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
            <VideoIcon className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            {!uploading && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setFile(null)}
                data-testid="button-remove-video"
              >
                Remove
              </Button>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {!uploading && (
            <Button 
              className="w-full" 
              onClick={handleUpload}
              data-testid="button-start-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Video
            </Button>
          )}
        </div>
      )}

      {result && (
        <div className="w-full space-y-4">
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle className="w-5 h-5" />
            <span>Upload Complete</span>
          </div>
          
          <div className="aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
            <video 
              src={result.secure_url} 
              controls 
              className="w-full h-full"
              poster={result.secure_url.replace(/\.[^/.]+$/, ".jpg")} 
            />
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
          >
            Upload Another
          </Button>
        </div>
      )}
    </Card>
  );
}
