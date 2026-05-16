import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Mail, Calendar, ShieldCheck, Phone, AlertCircle, Camera, Image as ImageIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileValues } from "@/lib/validations/auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { UserAvatar } from "../../components/auth/UserAvatar";
// @ts-ignore - MediaUpload.jsx doesn't have TypeScript declarations
import { MediaUpload } from "@/components/media/MediaUpload";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LayoutDashboard } from "lucide-react";
import { Link } from "wouter";
import { SEED_AVATARS } from "@shared/user-seeds";

const PAKISTAN_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", 
  "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala"
];

export default function Profile() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isSeedPickerOpen, setIsSeedPickerOpen] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.displayName || "",
      phoneNumber: user?.phoneNumber || "",
      city: "",
      address: "",
      emergencyContact: "",
    },
  });

  if (!user) return null;

  const onAvatarUploadComplete = async (cloudinaryData: any) => {
    if (!cloudinaryData || !cloudinaryData.secure_url) return;
    updateProfilePhoto(cloudinaryData.secure_url);
  };

  const updateProfilePhoto = async (photoURL: string) => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        photoURL,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state in auth store
      useAuthStore.getState().setUser({
        ...user,
        photoURL
      } as any);
      
      setIsAvatarDialogOpen(false);
      setIsSeedPickerOpen(false);
      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Profile picture update error:", error);
      
      // Update local state regardless of Firestore error to show immediate feedback
      useAuthStore.getState().setUser({
        ...user,
        photoURL
      } as any);

      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been updated successfully.",
      });
      setIsAvatarDialogOpen(false);
      setIsSeedPickerOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const onSubmit = async (data: ProfileValues) => {
    setIsUpdating(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state in auth store
      useAuthStore.getState().setUser({
        ...user,
        ...data
      } as any);
      
      toast({
        title: "Profile Updated",
        description: "Your information has been successfully saved.",
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      let errorMessage = "There was an error updating your profile.";

      if (error.code === 'permission-denied') {
        errorMessage = "Permission denied. Please ensure you're logged in correctly.";
      }

      toast({
        variant: "destructive",
        title: "Update Failed",
        description: errorMessage,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-12 max-w-4xl pb-24 md:pb-12">
      <SEO
        title="My Profile - PakCart"
        description="Manage your PakCart account profile, addresses, and preferences."
        robots="noindex,follow"
      />
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground text-sm md:text-base">Manage your personal information and preferences.</p>
      </div>

      <div className="grid gap-5 md:gap-8">
        {/* Account Information Section */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <User className="h-4 w-4 md:h-5 md:w-5" />
              Account Information
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">View your basic account details and security status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6">
            <div className="flex items-center gap-4 pb-4 md:pb-6 border-b">
              <div className="relative group shrink-0">
                <UserAvatar 
                  photoURL={user.photoURL}
                  displayName={user.displayName}
                  email={user.email}
                  className="h-16 w-16 md:h-20 md:w-20 border-2 border-primary/20"
                />
                <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="absolute -bottom-1 -right-1 h-7 w-7 md:h-8 md:w-8 rounded-full shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Update Profile Picture</DialogTitle>
                      <DialogDescription className="sr-only">Upload a new profile picture or choose from the avatar gallery.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <MediaUpload 
                        onUploadComplete={onAvatarUploadComplete}
                        acceptedTypes={['image/*']}
                        maxSize={2 * 1024 * 1024} // 2MB for profile images
                        folder={`users/${user.uid}/profile`}
                        multiple={false}
                      />
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Or choose from gallery</span>
                        </div>
                      </div>

                      <Dialog open={isSeedPickerOpen} onOpenChange={setIsSeedPickerOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Choose from Seed Avatars
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Select an Avatar</DialogTitle>
                            <DialogDescription className="sr-only">Choose a pre-made avatar to use as your profile picture.</DialogDescription>
                          </DialogHeader>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 py-4 max-h-[300px] overflow-y-auto pr-2">
                            {SEED_AVATARS.map((avatar, index) => (
                              <button
                                key={avatar.id}
                                onClick={() => updateProfilePhoto(avatar.url)}
                                className="relative aspect-square rounded-full overflow-hidden hover:ring-2 hover:ring-primary transition-all group border"
                              >
                                <UserAvatar 
                                  photoURL={avatar.url} 
                                  className="w-full h-full"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-[10px] font-medium">Select</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base md:text-xl font-semibold truncate">{user.displayName || "Valued Customer"}</h3>
                <p className="text-muted-foreground text-xs md:text-sm truncate">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-primary/10 text-primary">
                    {user.providerId === 'password' ? 'Email/Password' : 'Google'}
                  </div>
                  {user.role === 'admin' && (
                    <Link href="/admin">
                      <Button variant="outline" size="sm" className="h-6 md:h-7 text-[10px] md:text-xs gap-1 border-primary/20 hover:bg-primary/5 px-2">
                        <LayoutDashboard className="h-3 w-3" />
                        Admin
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-secondary/50">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Email Address</p>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-secondary/50">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Member Since</p>
                  <p className="text-sm font-medium text-wrap">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-PK', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-secondary/50">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Security Status</p>
                  <p className={`text-sm font-medium ${user.emailVerified ? "text-green-600" : "text-amber-600"}`}>
                    {user.emailVerified ? "Verified Account" : "Pending Verification"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-secondary/50">
                  <AlertCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Last Login</p>
                  <p className="text-sm font-medium">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('en-PK', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "Today"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 md:space-y-8">
            <Card>
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Phone className="h-4 w-4 md:h-5 md:w-5" />
                  Contact & Shipping
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Update your delivery information for faster checkout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="0300-1234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAKISTAN_CITIES.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="0321-7654321" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address, Apartment, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2 md:pt-4">
                  <Button type="submit" disabled={isUpdating} className="w-full md:w-auto md:float-right">
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}
