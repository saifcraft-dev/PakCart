// src/components/MediaUpload.jsx
import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCloudinary } from '../hooks/use-cloudinary';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function MediaUpload({
  onUploadComplete,
  acceptedTypes = ['image/*', 'video/*', 'application/pdf'],
  maxSize = 10 * 1024 * 1024, // 10MB default
  folder = 'uploads',
  multiple = false,
  className
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  const { upload, progress, isUploading, error, reset } = useCloudinary();
  const [uploadedData, setUploadedData] = useState(null);

  const handleFiles = useCallback((files) => {
    const validFiles = Array.from(files).filter(file => {
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type;
      });
      const isValidSize = file.size <= maxSize;
      return isValidType && isValidSize;
    });

    if (multiple) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    } else {
      setSelectedFiles(validFiles.slice(0, 1));
    }
  }, [acceptedTypes, maxSize, multiple]);

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      if (multiple) {
        const results = await Promise.all(
          selectedFiles.map(file => upload(file))
        );
        const successfulUploads = results.filter(Boolean);
        if (successfulUploads.length > 0) {
          setUploadedData(successfulUploads);
          onUploadComplete?.(successfulUploads);
        }
      } else {
        const result = await upload(selectedFiles[0]);
        if (result) {
          setUploadedData(result);
          onUploadComplete?.(result);
        }
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      <Card
        className={cn(
          "relative border-2 border-dashed p-8 transition-colors duration-200 flex flex-col items-center justify-center min-h-[200px] cursor-pointer",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={onFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-2 text-center">
          {isUploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          ) : (
            <Upload className="h-10 w-10 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isUploading ? "Uploading..." : "Click or drag files to upload"}
            </p>
            <p className="text-xs text-muted-foreground">
              {acceptedTypes.join(', ')} (Max {Math.round(maxSize / 1024 / 1024)}MB)
            </p>
          </div>
        </div>
      </Card>

      {/* File List / Previews */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="grid gap-3"
          >
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-card border rounded-lg gap-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {file.type.startsWith('image/') ? (
                    <div className="h-10 w-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <FileText className="h-10 w-10 text-muted-foreground p-2" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress and Actions */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Overall Progress</span>
            <span>{Math.round(progress?.percentage || 0)}%</span>
          </div>
          <Progress value={progress?.percentage || 0} className="h-2" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {uploadedData && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400 p-3 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          <span>Upload complete!</span>
        </div>
      )}

      {selectedFiles.length > 0 && !isUploading && !uploadedData && (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleUpload}
            data-testid="button-upload-submit"
          >
            Upload {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedFiles([])}
            disabled={isUploading}
          >
            Clear
          </Button>
        </div>
      )}

      {uploadedData && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setSelectedFiles([]);
            setUploadedData(null);
            reset();
          }}
        >
          Upload More
        </Button>
      )}
    </div>
  );
}
