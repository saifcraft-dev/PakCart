// client/src/components/MediaGallery.jsx
import { useState, useEffect } from 'react';
import { 
  Grid, 
  List, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Tag,
  Maximize2,
  X,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { searchMedia, deleteMediaMetadata, updateMediaMetadata } from '@/services/mediaMetadataService';
import { getThumbnail, getOptimizedImage } from '@/services/imageTransformService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function MediaGallery() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [bulkSelection, setBulkSelection] = useState([]);

  useEffect(() => {
    if (user) {
      loadMedia();
    }
  }, [user]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const results = await searchMedia(user.uid);
      setMedia(results);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load media gallery."
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMedia = media.filter(item => {
    const matchesSearch = item.cloudinaryPublicId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.format?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.fileType === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id) => {
    try {
      await deleteMediaMetadata(id);
      setMedia(prev => prev.filter(item => item.id !== id));
      toast({ title: "Deleted", description: "Media removed from gallery." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete media." });
    }
  };

  const toggleBulkSelect = (id) => {
    setBulkSelection(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(bulkSelection.map(id => deleteMediaMetadata(id)));
      setMedia(prev => prev.filter(item => !bulkSelection.includes(item.id)));
      setBulkSelection([]);
      toast({ title: "Success", description: "Bulk deletion complete." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete some items." });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground italic">Loading your treasures...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search media..." 
            className="pl-9 bg-background" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex bg-muted p-1 rounded-lg">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <Button 
            variant={filterType === 'all' ? 'secondary' : 'outline'} 
            size="sm" 
            onClick={() => setFilterType('all')}
            className="h-8"
          >
            All
          </Button>
          <Button 
            variant={filterType === 'image' ? 'secondary' : 'outline'} 
            size="sm" 
            onClick={() => setFilterType('image')}
            className="h-8 gap-2"
          >
            <ImageIcon className="h-3 w-3" /> Images
          </Button>
          <Button 
            variant={filterType === 'video' ? 'secondary' : 'outline'} 
            size="sm" 
            onClick={() => setFilterType('video')}
            className="h-8 gap-2"
          >
            <Video className="h-3 w-3" /> Videos
          </Button>

          {bulkSelection.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8 gap-2 ml-2">
              <Trash2 className="h-3 w-3" /> Delete ({bulkSelection.length})
            </Button>
          )}
        </div>
      </div>

      {/* Media Grid/List */}
      {filteredMedia.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No media found</h3>
          <p className="text-muted-foreground">Try adjusting your filters or upload some new treasures.</p>
        </div>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" 
            : "flex flex-col gap-2"
        )}>
          {filteredMedia.map((item) => (
            <div 
              key={item.id}
              className={cn(
                "group relative bg-card rounded-xl border transition-all hover:shadow-md overflow-hidden",
                bulkSelection.includes(item.id) && "ring-2 ring-primary",
                viewMode === 'list' && "flex items-center p-2"
              )}
            >
              {/* Checkbox for bulk selection */}
              <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <input 
                  type="checkbox" 
                  checked={bulkSelection.includes(item.id)}
                  onChange={() => toggleBulkSelect(item.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              {/* Media Preview */}
              <div 
                className={cn(
                  "cursor-pointer overflow-hidden",
                  viewMode === 'grid' ? "aspect-square" : "h-12 w-12 rounded-lg mr-4"
                )}
                onClick={() => setSelectedMedia(item)}
              >
                {item.fileType === 'image' ? (
                  <img 
                    src={getThumbnail(item.cloudinaryPublicId, 300)} 
                    alt={item.cloudinaryPublicId}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-muted flex items-center justify-center">
                    {item.fileType === 'video' ? <Video className="h-6 w-6 text-primary" /> : <FileText className="h-6 w-6 text-primary" />}
                  </div>
                )}
              </div>

              {/* Item Details (List view only) */}
              {viewMode === 'list' && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.cloudinaryPublicId}</p>
                  <p className="text-xs text-muted-foreground uppercase">{item.format} • {(item.fileSize / 1024).toFixed(1)} KB</p>
                </div>
              )}

              {/* Actions Overlay (Grid view) */}
              {viewMode === 'grid' && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedMedia(item)}>
                        <Maximize2 className="mr-2 h-4 w-4" /> View Full
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Preview Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          <DialogTitle className="sr-only">Media Preview</DialogTitle>
          <DialogDescription className="sr-only">Full-size preview of the selected media file.</DialogDescription>
          {selectedMedia && (
            <div className="relative flex flex-col items-center justify-center min-h-[50vh]">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/10"
                onClick={() => setSelectedMedia(null)}
              >
                <X className="h-6 w-6" />
              </Button>

              <div className="w-full h-full flex items-center justify-center p-4">
                {selectedMedia.fileType === 'image' ? (
                  <img 
                    src={getOptimizedImage(selectedMedia.cloudinaryPublicId)} 
                    alt="Preview"
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-white">
                    <Video className="h-20 w-20 text-primary" />
                    <p className="text-xl">Video preview coming soon</p>
                    <Button asChild variant="outline">
                      <a href={selectedMedia.cloudinaryUrl} target="_blank" rel="noreferrer">Open Original</a>
                    </Button>
                  </div>
                )}
              </div>

              <div className="w-full bg-card/10 backdrop-blur-md p-6 text-white border-t border-white/10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedMedia.cloudinaryPublicId}</h3>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{selectedMedia.format.toUpperCase()}</Badge>
                      <Badge variant="secondary">{(selectedMedia.fileSize / 1024 / 1024).toFixed(2)} MB</Badge>
                      {selectedMedia.dimensions && (
                        <Badge variant="secondary">{selectedMedia.dimensions.width}x{selectedMedia.dimensions.height}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="text-black bg-white hover:bg-white/90">
                      <a href={selectedMedia.cloudinaryUrl} target="_blank" rel="noreferrer">Download</a>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => { handleDelete(selectedMedia.id); setSelectedMedia(null); }}>
                      Delete Permanently
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
