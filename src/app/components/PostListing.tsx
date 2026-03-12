import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { categories, locations, healthStatuses, durations } from "../data/mockData";
import { useCreateListing, useUploadImage } from "../../hooks/useLivestock";
import { useAuthStore } from "../../stores/authStore";
import { isSupabaseConfigured } from "../../lib/supabase";
import { toast } from "sonner";

export function PostListing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const createListing = useCreateListing();
  const uploadImage = useUploadImage();
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    breed: '',
    age: '',
    weight: '',
    description: '',
    location: '',
    health: '',
    startingPrice: '',
    duration: '',
  });

  const handlePhotoAdd = () => {
    if (photos.length >= 4) return;

    if (isSupabaseConfigured) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setPhotoFiles(prev => [...prev, file]);
          setPhotos(prev => [...prev, URL.createObjectURL(file)]);
        }
      };
      input.click();
    } else {
      setPhotos([...photos, `https://via.placeholder.com/200?text=Photo+${photos.length + 1}`]);
    }
  };

  const handlePhotoRemove = (index: number) => {
    const removedUrl = photos[index];
    if (removedUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(removedUrl);
    }
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoFiles(photoFiles.filter((_, i) => i !== index));
  };

  // Revoke all object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/auth');
      return;
    }

    // Validate select fields
    const requiredSelects: { field: keyof typeof formData; label: string }[] = [
      { field: 'category', label: 'Category' },
      { field: 'location', label: 'Location' },
      { field: 'health', label: 'Health status' },
      { field: 'duration', label: 'Duration' },
    ];

    const missingFields = requiredSelects.filter(({ field }) => !formData[field]).map(({ label }) => label);
    if (missingFields.length > 0) {
      toast.error(`Please select: ${missingFields.join(', ')}`);
      return;
    }

    // Validate starting price
    const parsedPrice = parseFloat(formData.startingPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Starting price must be a positive number');
      return;
    }

    try {
      // Upload images if configured
      let imageUrls: string[] = [];
      if (isSupabaseConfigured && photoFiles.length > 0) {
        for (const file of photoFiles) {
          const url = await uploadImage.mutateAsync({ file, userId: user.id });
          imageUrls.push(url);
        }
      } else {
        imageUrls = photos;
      }

      const durationMap: Record<string, number> = { '1 day': 1, '3 days': 3, '7 days': 7, '14 days': 14 };

      await createListing.mutateAsync({
        title: formData.title,
        category: formData.category,
        breed: formData.breed,
        age: formData.age,
        weight: formData.weight,
        description: formData.description,
        location: formData.location,
        health: formData.health,
        starting_price: parsedPrice,
        duration_days: durationMap[formData.duration] || 7,
        image_urls: imageUrls,
      });

      toast.success('Listing submitted for review!');
      setTimeout(() => navigate('/my-listings'), 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create listing');
    }
  };

  const isSubmitting = createListing.isPending || uploadImage.isPending;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 bg-background z-10 border-b p-4 flex items-center gap-3">
        <button onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Post Livestock</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        <div>
          <Label className="mb-3 block">PHOTOS</Label>
          <div className="grid grid-cols-4 gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handlePhotoRemove(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <button
                type="button"
                onClick={handlePhotoAdd}
                className="aspect-square bg-muted rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary transition-colors"
              >
                <Plus className="w-8 h-8 text-muted-foreground" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Up to 4 photos</p>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">BASIC INFO</h3>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g., Ngoni Bull" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="breed">Breed</Label>
            <Input id="breed" placeholder="e.g., Brahman" value={formData.breed} onChange={(e) => setFormData({ ...formData, breed: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input id="age" placeholder="e.g., 3 yrs" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input id="weight" placeholder="e.g., 450 kg" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Describe your livestock..." rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">LOCATION & HEALTH</h3>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Select value={formData.location} onValueChange={(v) => setFormData({ ...formData, location: v })}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {locations.map(loc => (<SelectItem key={loc} value={loc}>{loc}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="health">Health</Label>
            <Select value={formData.health} onValueChange={(v) => setFormData({ ...formData, health: v })}>
              <SelectTrigger><SelectValue placeholder="Select health status" /></SelectTrigger>
              <SelectContent>
                {healthStatuses.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">AUCTION DETAILS</h3>
          <div className="space-y-2">
            <Label htmlFor="price">Starting Price ($)</Label>
            <Input id="price" type="number" placeholder="e.g., 800" value={formData.startingPrice} onChange={(e) => setFormData({ ...formData, startingPrice: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Select value={formData.duration} onValueChange={(v) => setFormData({ ...formData, duration: v })}>
              <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
              <SelectContent>
                {durations.map(dur => (<SelectItem key={dur} value={dur}>{dur}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1 text-sm">
            <p className="flex items-center gap-2"><span>ℹ️</span><span>5% platform fee</span></p>
            <p className="flex items-center gap-2"><span>ℹ️</span><span>48hr payment window</span></p>
            <p className="flex items-center gap-2"><span>ℹ️</span><span>Inspection allowed</span></p>
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Posting...</>
            ) : 'Post Listing'}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">Reviewed within 24hrs</p>
        </div>
      </form>
    </div>
  );
}
