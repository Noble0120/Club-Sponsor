import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropUploadProps {
  urls: string[];
  onFiles: (files: FileList | File[]) => void;
  onRemove: (index: number) => void;
  isUploading?: boolean;
  label?: string;
  className?: string;
}

// Supports both click-to-browse and dragging files straight in (e.g. images/videos saved
// from WeChat) — dropping anywhere on the label triggers the same upload path as the picker.
export function FileDropUpload({ urls, onFiles, onRemove, isUploading, label, className }: FileDropUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={className}>
      {urls.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {urls.map((url, idx) => (
            <div key={idx} className="flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs">
              <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                附件 {idx + 1}
              </a>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          dragOver && "border-primary bg-accent text-primary",
        )}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isUploading ? "上传中..." : (label ?? "点击选择文件，或直接把文件拖到这里")}
        <input
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
