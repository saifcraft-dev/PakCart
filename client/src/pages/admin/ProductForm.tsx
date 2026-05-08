import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product, type InsertProduct, type Category } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, Loader2, Save, Plus, Trash2, TrendingUp, Layers, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { ImageUploader } from "@/components/product/ImageUploader";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
// @ts-ignore - VideoUpload.jsx doesn't have TypeScript declarations
import { VideoUpload } from "@/components/VideoUpload";
import { useEffect, Fragment, useState } from "react";
import { productFirestoreService } from "@/services/productFirestoreService";
import { categoryFirestoreService } from "@/services/categoryFirestoreService";
import { settingsFirestoreService } from "@/services/settingsFirestoreService";
import { useAIDescription, useAISEO, useAIReviews, useAIVariantNames, useAIFullContent } from "@/hooks/use-ai";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminProductForm() {
  const [, params] = useRoute("/admin/products/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = params?.id ? params.id : null;
  const isEditing = !!id;

  const { data: product, isLoading: isProductLoading } = useQuery<Product | null>({
    queryKey: ["products", id],
    queryFn: () => productFirestoreService.getProductById(id!),
    enabled: isEditing,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => categoryFirestoreService.getAllCategories(),
  });

  const { data: profitRulesSettings } = useQuery({
    queryKey: ["settings", "profitRules"],
    queryFn: () => settingsFirestoreService.getProfitRules(),
  });

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      longDescription: "",
      price: 0,
      profit: 0,
      wholesalePrice: 0,
      originalPrice: 0,
      images: [],
      videoUrl: "",
      categoryId: "",
      stock: 0,
      active: true,
      inStock: true,
      rating: 0,
      reviewCount: 0,
      features: [],
      specifications: {},
      variants: [],
      labels: [],
    },
  });

  // Handle features array
  const { fields: featureFields, append: appendFeature, remove: removeFeature, replace: replaceFeatures } = useFieldArray({
    control: form.control,
    name: "features" as any,
  });

  // Handle variants array
  const { fields: variantFields, append: appendVariant, remove: removeVariant, replace: replaceVariants } = useFieldArray({
    control: form.control,
    name: "variants" as any,
  });

  const costPrice = form.watch("price");
  useEffect(() => {
    if (costPrice && costPrice > 0 && profitRulesSettings?.rules?.length) {
      const profit = settingsFirestoreService.calculateProfit(costPrice, profitRulesSettings.rules);
      form.setValue("profit", profit, { shouldValidate: true });
    }
  }, [costPrice, profitRulesSettings]);

  useEffect(() => {
    if (product) {
      form.reset({
        ...product,
        profit: product.profit || 0,
        wholesalePrice: product.wholesalePrice || 0,
        images: product.images || [],
        videoUrl: product.videoUrl || "",
        categoryId: product.categoryId ? String(product.categoryId) : "",
        rating: typeof product.rating === 'string' ? parseFloat(product.rating) : (product.rating || 0),
        reviewCount: product.reviewCount || 0,
        features: product.features || [],
        specifications: product.specifications || {},
        variants: product.variants || [],
        labels: product.labels || [],
      });
    }
  }, [product, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      if (isEditing && id) {
        await productFirestoreService.updateProduct(id, data);
      } else {
        await productFirestoreService.createProduct(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: isEditing ? "Product updated" : "Product created",
        description: `Successfully ${isEditing ? "updated" : "created"} the product.`,
      });
      setLocation("/admin/products");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const { generate: generateAIDesc, isLoading: isAIDescLoading } = useAIDescription();
  const { generate: generateAISEOMeta, isLoading: isAISEOLoading } = useAISEO();
  const { generate: generateAIReviews, isLoading: isAIReviewsLoading } = useAIReviews();
  const { generate: generateAIVariantNames } = useAIVariantNames();
  const { generate: generateAIFullContent, isLoading: isAIFullContentLoading, lastError: aiContentError } = useAIFullContent();
  const [aiVariantLoadingIndex, setAiVariantLoadingIndex] = useState<number | null>(null);
  const [aiExtraDetails, setAiExtraDetails] = useState("");

  const name = form.watch("name");

  const handleGenerateDescription = async () => {
    const productName = form.getValues("name");
    const price = form.getValues("price");
    const catId = form.getValues("categoryId");
    const cat = categories?.find(c => c.id === catId);
    if (!productName) {
      toast({ title: "Enter a product name first", variant: "destructive" });
      return;
    }
    const desc = await generateAIDesc(productName, cat?.name || catId || "General", price || 0);
    if (desc) {
      form.setValue("description", desc, { shouldValidate: true });
      toast({ title: "AI Description Generated", description: "Description has been auto-filled." });
    }
  };

  const handleGenerateSEO = async () => {
    const productName = form.getValues("name");
    const catId = form.getValues("categoryId");
    const description = form.getValues("description") || "";
    const cat = categories?.find(c => c.id === catId);
    if (!productName) {
      toast({ title: "Enter a product name first", variant: "destructive" });
      return;
    }
    const meta = await generateAISEOMeta(productName, cat?.name || catId || "General", description);
    if (meta) {
      toast({
        title: "AI SEO Meta Generated",
        description: `Title: ${meta.title}`,
      });
    }
  };

  const handleGenerateFullContent = async () => {
    const images = (form.getValues("images") || []) as string[];
    if (images.length === 0) {
      toast({
        title: "Upload product images first",
        description: "AI needs at least one product image to analyze.",
        variant: "destructive",
      });
      return;
    }

    const nameHint = form.getValues("name") || "";
    const catId = form.getValues("categoryId");
    const currentCat = categories?.find(c => c.id === catId);
    const availableCategories = (categories || [])
      .map(c => c.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    const existingVariants = (form.getValues("variants") || []) as any[];
    const variantTypes = existingVariants
      .map(v => v?.name)
      .filter((n: string) => typeof n === "string" && n.trim().length > 0);

    const variantOptionImages: string[] = existingVariants.flatMap((v) =>
      ((v?.options || []) as any[])
        .map((o) => (typeof o?.image === "string" ? o.image : ""))
        .filter((url: string) => !!url)
    );

    const { result, error } = await generateAIFullContent(images, {
      nameHint,
      currentCategory: currentCat?.name || "",
      availableCategories,
      variantTypes,
      variantOptionImages,
      extraDetails: aiExtraDetails,
    });

    if (!result) {
      toast({
        title: "AI couldn't generate content",
        description: error || aiContentError || "Try again or check your images.",
        variant: "destructive",
        duration: 10000,
      });
      return;
    }

    if (result.name) {
      form.setValue("name", result.name, { shouldValidate: true, shouldDirty: true });
    }
    if (result.slug) {
      setTimeout(() => {
        form.setValue("slug", result.slug, { shouldValidate: true, shouldDirty: true });
      }, 0);
    }
    if (result.shortDescription) {
      form.setValue("description", result.shortDescription, { shouldValidate: true, shouldDirty: true });
    }
    if (result.longDescriptionHtml) {
      form.setValue("longDescription", result.longDescriptionHtml, { shouldValidate: true, shouldDirty: true });
    }
    if (result.features.length > 0) {
      replaceFeatures(result.features as any);
    }

    let categoryApplied = "";
    if (result.category) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const target = norm(result.category);
      const match = categories?.length
        ? (categories.find((c) => norm(c.name || "") === target) ||
           categories.find((c) => norm(c.name || "").includes(target) || target.includes(norm(c.name || ""))))
        : undefined;
      if (match) {
        form.setValue("categoryId", String(match.id), { shouldValidate: true, shouldDirty: true });
        categoryApplied = match.name;
      } else {
        console.log("[AI] No matching category found for:", result.category, "— creating new category");
        try {
          const newSlug = result.category
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_]+/g, "-")
            .replace(/^-+|-+$/g, "");
          const newCat = await categoryFirestoreService.createCategory({
            name: result.category,
            slug: newSlug,
            description: undefined,
            image: undefined,
            parentCategoryId: undefined,
          });
          queryClient.setQueryData(["categories"], (old: Category[] | undefined) => {
            const list = old ? [...old, newCat] : [newCat];
            return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          });
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          form.setValue("categoryId", String(newCat.id), { shouldValidate: true, shouldDirty: true });
          categoryApplied = `${result.category} (auto-created)`;
        } catch (err: any) {
          console.warn("[AI] Failed to auto-create category:", err);
          toast({
            title: "Category not found",
            description: `AI suggested "${result.category}" but it couldn't be created. Please select a category manually.`,
            variant: "destructive",
          });
        }
      }
    }

    // Build groups list. Prefer multi-axis variantGroups; fall back to legacy single axis.
    const groups: { type: string; options: string[] }[] =
      result.variantGroups && result.variantGroups.length > 0
        ? result.variantGroups
        : result.variantType && result.variants.length > 0
        ? [{ type: result.variantType, options: result.variants }]
        : [];

    const variantsAddedPerType: Record<string, number> = {};
    const skippedGroups: { type: string; options: string[] }[] = [];

    if (groups.length > 0) {
      const existing = (form.getValues("variants") || []) as any[];
      const basePrice = (form.getValues("price") as number) || 0;

      const isEmpty =
        existing.length === 0 ||
        existing.every((v) => !v?.name?.trim() && (!v?.options || v.options.length === 0));

      if (isEmpty) {
        // Replace with all detected groups at once.
        const newVariants = groups.map((g) => ({
          id: Math.random().toString(36).slice(2, 11),
          name: g.type,
          options: g.options.map((v) => ({
            id: Math.random().toString(36).slice(2, 11),
            value: v,
            price: basePrice,
            image: "",
          })),
        }));
        replaceVariants(newVariants as any);
        for (const g of groups) variantsAddedPerType[g.type] = g.options.length;
      } else {
        // Form already has variants. For each AI-detected group, try to fill empty
        // option slots inside a same-named existing axis. Otherwise skip and surface as suggestion.
        groups.forEach((g) => {
          const matchIdx = existing.findIndex(
            (v) => (v?.name || "").trim().toLowerCase() === g.type.toLowerCase()
          );
          if (matchIdx === -1) {
            skippedGroups.push(g);
            return;
          }
          const v = existing[matchIdx];
          const opts = (v?.options || []) as any[];
          const emptyOptionIndices = opts
            .map((o, i) => ({ o, i }))
            .filter(({ o }) => !o?.value?.toString().trim())
            .map(({ i }) => i);

          if (emptyOptionIndices.length === 0) {
            skippedGroups.push(g);
            return;
          }

          let added = 0;
          emptyOptionIndices.forEach((optionIdx, suggestionIdx) => {
            const newName = g.options[suggestionIdx];
            if (!newName) return;
            form.setValue(
              `variants.${matchIdx}.options.${optionIdx}.value` as any,
              newName,
              { shouldValidate: true, shouldDirty: true }
            );
            const currentPrice = form.getValues(
              `variants.${matchIdx}.options.${optionIdx}.price` as any
            );
            if (typeof currentPrice !== "number" || !currentPrice) {
              form.setValue(
                `variants.${matchIdx}.options.${optionIdx}.price` as any,
                basePrice,
                { shouldDirty: true }
              );
            }
            added += 1;
          });
          if (added > 0) variantsAddedPerType[g.type] = added;
        });
      }
    }

    const totalVariantsAdded = Object.values(variantsAddedPerType).reduce((a, b) => a + b, 0);

    const filled: string[] = [];
    if (result.name) filled.push("name");
    if (categoryApplied) filled.push(`category (${categoryApplied})`);
    if (result.shortDescription) filled.push("short description");
    if (result.longDescriptionHtml) filled.push("long description");
    if (result.features.length) filled.push(`${result.features.length} features`);
    if (totalVariantsAdded > 0) {
      const parts = Object.entries(variantsAddedPerType).map(
        ([t, n]) => `${n} ${t.toLowerCase()}`
      );
      filled.push(`${parts.join(" + ")} variants`);
    }

    let suggestionText = "";
    if (skippedGroups.length > 0) {
      suggestionText =
        " " +
        skippedGroups
          .map((g) => `Suggested ${g.type}: ${g.options.join(", ")}`)
          .join(". ") +
        " (you already have variants set up — review manually).";
    }

    toast({
      title: "AI content generated",
      description: filled.length
        ? `Filled: ${filled.join(", ")}.${suggestionText}`
        : "Content was returned but no fields matched.",
    });
  };

  const handleGenerateVariantNames = async (vIndex: number) => {
    const productName = form.getValues("name");
    const catId = form.getValues("categoryId");
    const cat = categories?.find(c => c.id === catId);
    const variantType = form.getValues(`variants.${vIndex}.name` as any) as string || "";
    const options = (form.getValues(`variants.${vIndex}.options` as any) || []) as any[];
    const productImages = (form.getValues("images") || []) as string[];

    if (!productName) {
      toast({ title: "Enter a product name first", variant: "destructive" });
      return;
    }

    const optionsWithImages = options
      .map((o, i) => ({ index: i, image: o?.image as string | undefined }))
      .filter(o => typeof o.image === "string" && o.image.length > 0);

    if (optionsWithImages.length === 0) {
      toast({
        title: "No variant images uploaded",
        description: "Upload at least one option image before auto-naming.",
        variant: "destructive",
      });
      return;
    }

    setAiVariantLoadingIndex(vIndex);
    try {
      const { names, error } = await generateAIVariantNames(
        productName,
        cat?.name || catId || "General",
        variantType,
        optionsWithImages.map(o => o.image as string),
        productImages,
      );

      if (error) {
        toast({
          title: "AI naming failed",
          description: error,
          variant: "destructive",
        });
        return;
      }

      if (!names || names.length === 0) {
        toast({
          title: "AI couldn't name the variants",
          description: "The model returned no usable names. Check the variant images are loading and try again.",
          variant: "destructive",
        });
        return;
      }

      let applied = 0;
      optionsWithImages.forEach((o, idx) => {
        const newName = names[idx];
        if (newName) {
          form.setValue(`variants.${vIndex}.options.${o.index}.value` as any, newName, { shouldValidate: true, shouldDirty: true });
          applied++;
        }
      });

      toast({
        title: `Named ${applied} variant${applied === 1 ? "" : "s"}`,
        description: applied < optionsWithImages.length
          ? `${optionsWithImages.length - applied} option${optionsWithImages.length - applied === 1 ? "" : "s"} could not be named — review and edit if needed.`
          : "Review the names and edit if needed.",
      });
    } finally {
      setAiVariantLoadingIndex(null);
    }
  };

  const handleGenerateReviews = async () => {
    if (!isEditing || !id) {
      toast({ title: "Save the product first before generating reviews.", variant: "destructive" });
      return;
    }
    const productName = form.getValues("name");
    const catId = form.getValues("categoryId");
    const cat = categories?.find(c => c.id === catId);
    if (!productName) {
      toast({ title: "Enter a product name first", variant: "destructive" });
      return;
    }
    const reviews = await generateAIReviews(productName, cat?.name || catId || "General", 5);
    if (reviews && reviews.length > 0) {
      const commentsRef = collection(db, "comments");
      for (const review of reviews) {
        await addDoc(commentsRef, {
          productId: id,
          userName: review.userName,
          content: review.content,
          rating: review.rating,
          userId: "ai-generated",
          isSeeded: true,
          createdAt: serverTimestamp(),
          helpfulCount: 0,
        });
      }
      toast({
        title: `${reviews.length} AI Reviews Generated`,
        description: "Reviews have been added to this product.",
      });
    }
  };

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEditing && name) {
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      form.setValue("slug", slug, { shouldValidate: true });
    }
  }, [name, isEditing, form]);

  // Auto-generate price for variants from base price
  const basePrice = form.watch("price");
  useEffect(() => {
    if (basePrice > 0) {
      const currentVariants = form.getValues("variants") || [];
      let updated = false;
      const newVariants = currentVariants.map(variant => {
        const newOptions = variant.options.map(option => {
          if (!option.price || option.price === 0) {
            updated = true;
            return { ...option, price: basePrice };
          }
          return option;
        });
        return { ...variant, options: newOptions };
      });
      
      if (updated) {
        form.setValue("variants", newVariants, { shouldValidate: true });
      }
    }
  }, [basePrice, form]);

  const onSubmit = (data: InsertProduct) => {
    mutation.mutate(data);
  };

  if (isEditing && isProductLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-1">
      <SEO title="Admin Product Form - PakCart" robots="noindex,follow" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/products">
                <Button variant="outline" size="icon" className="h-9 w-9 hover-elevate shadow-sm border-emerald-200 text-emerald-700">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-emerald-950">
                  {isEditing ? "Edit Product" : "New Product"}
                </h2>
                <p className="text-emerald-600/70 text-sm font-medium">
                  {isEditing ? "Modify your product details and availability" : "Add a new item to your store inventory"}
                </p>
              </div>
            </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              <Card className="border-emerald-100 bg-emerald-50/10 backdrop-blur-sm shadow-sm">
                <CardHeader className="bg-emerald-50/30 border-b border-emerald-100">
                  <CardTitle className="text-xl text-emerald-900">Basic Information</CardTitle>
                  <CardDescription>Primary details that customers will see first</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 font-semibold text-emerald-900">
                            Product Name
                            <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Kashmiri Pashmina Shawl" className="bg-background/50 focus-visible:ring-emerald-500 border-emerald-100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold text-emerald-900">Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. kashmiri-pashmina-shawl" className="bg-background/50 font-mono text-xs focus-visible:ring-emerald-500 border-emerald-100" {...field} />
                          </FormControl>
                          <FormDescription className="text-[10px] text-emerald-600/70">URL-friendly identifier</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <FormLabel>Short Description</FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateDescription}
                            disabled={isAIDescLoading}
                            className="h-7 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            data-testid="button-ai-generate-description"
                          >
                            {isAIDescLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {isAIDescLoading ? "Generating…" : "Generate with AI"}
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief overview of the product..." 
                            className="min-h-[80px] bg-background/50"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="longDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Long Description</FormLabel>
                        <FormControl>
                          <RichTextEditor 
                            value={field.value || ""} 
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-emerald-100 bg-emerald-50/10 backdrop-blur-sm shadow-sm">
                <CardHeader className="bg-emerald-50/30 border-b border-emerald-100">
                  <CardTitle className="text-xl text-emerald-900">Product Media</CardTitle>
                  <CardDescription>Upload images and a product video</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Images (Max 15)</FormLabel>
                        <FormControl>
                          <ImageUploader 
                            value={field.value || []}
                            onChange={(urls) => field.onChange(urls)}
                            maxImages={15}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="videoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Video</FormLabel>
                        <FormControl>
                          <VideoUpload 
                            onUploadComplete={(data: any) => field.onChange(data.secure_url)}
                            value={field.value}
                          />
                        </FormControl>
                        <FormDescription>Upload a product demonstration video</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-emerald-100 bg-emerald-50/10 backdrop-blur-sm shadow-sm overflow-visible">
                <CardHeader className="bg-emerald-50/30 border-b border-emerald-100 flex flex-row items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2 text-emerald-900">
                      <Layers className="h-5 w-5" />
                      Product Variants
                    </CardTitle>
                    <CardDescription>Add options like Color, Size, or Material</CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => appendVariant({ id: Math.random().toString(36).substr(2, 9), name: "", options: [] })}
                    className="hover-elevate bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Variant Type
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {variantFields.map((variant, vIndex) => (
                    <div key={variant.id} className="p-4 rounded-xl border border-border/50 bg-background/30 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name={`variants.${vIndex}.name` as any}
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Variant Type Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Color" className="bg-background/50 h-8" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateVariantNames(vIndex)}
                          disabled={aiVariantLoadingIndex === vIndex}
                          className="mt-6 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover-elevate"
                          data-testid={`button-ai-name-variants-${vIndex}`}
                        >
                          {aiVariantLoadingIndex === vIndex ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          {aiVariantLoadingIndex === vIndex ? "Naming…" : "Auto-name with AI"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeVariant(vIndex)}
                          className="mt-6 text-muted-foreground hover:text-destructive hover-elevate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Options</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-primary hover:bg-transparent"
                            onClick={() => {
                              const options = form.getValues(`variants.${vIndex}.options` as any) || [];
                              form.setValue(`variants.${vIndex}.options` as any, [
                                ...options,
                                { id: Math.random().toString(36).substr(2, 9), value: "" }
                              ]);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Option
                          </Button>
                        </div>
                        
                        <div className="grid gap-2">
                          {(form.watch(`variants.${vIndex}.options` as any) || []).map((option: any, oIndex: number) => (
                            <div key={option.id} className="flex items-center gap-2">
                              <FormField
                                control={form.control}
                                name={`variants.${vIndex}.options.${oIndex}.value` as any}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <Input placeholder="e.g. Gold" className="bg-background/50 h-9" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`variants.${vIndex}.options.${oIndex}.price` as any}
                                render={({ field }) => (
                                  <FormItem className="w-24">
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        placeholder="Price" 
                                        className="bg-background/50 h-9" 
                                        {...field} 
                                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`variants.${vIndex}.options.${oIndex}.image` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <ImageUploader
                                        value={field.value ? [field.value] : []}
                                        onChange={(urls) => field.onChange(urls[0] || "")}
                                        maxImages={1}
                                        compact
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const options = form.getValues(`variants.${vIndex}.options` as any);
                                  form.setValue(`variants.${vIndex}.options` as any, options.filter((_: any, i: number) => i !== oIndex));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {variantFields.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl border-muted/20">
                      <Layers className="h-10 w-10 text-muted/20 mb-3" />
                      <p className="text-sm text-muted-foreground">No variants added. Perfect for simple products.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none bg-card/50 backdrop-blur-sm shadow-sm overflow-visible">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Features</CardTitle>
                    <CardDescription>Add key selling points for your product</CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => appendFeature("")}
                    className="hover-elevate"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Feature
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {featureFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 group">
                        <Input 
                          {...form.register(`features.${index}` as any)} 
                          placeholder="e.g. Hand-woven using traditional methods"
                          className="bg-background/50"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeFeature(index)}
                          className="text-muted-foreground hover:text-destructive hover-elevate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {featureFields.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg border-muted/20">
                        <Plus className="h-8 w-8 text-muted/20 mb-2" />
                        <p className="text-sm text-muted-foreground italic">No features added yet.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              <Card className="border-emerald-100 bg-emerald-50/10 backdrop-blur-sm shadow-sm">
                <CardHeader className="bg-emerald-50/30 border-b border-emerald-100">
                  <CardTitle className="text-xl text-emerald-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Pricing & Inventory
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="labels"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-emerald-900 font-semibold">Product Labels</FormLabel>
                            <div className="flex flex-wrap gap-2 pt-2">
                              {["Best Seller", "Liked", "New", "Featured", "Sale"].map((label) => {
                                const isSelected = (field.value || []).includes(label);
                                return (
                                  <Badge
                                    key={label}
                                    variant={isSelected ? "default" : "outline"}
                                    className={`cursor-pointer transition-all ${
                                      isSelected 
                                        ? "bg-emerald-600 hover:bg-emerald-700" 
                                        : "hover:bg-emerald-50 text-emerald-600 border-emerald-200"
                                    }`}
                                    onClick={() => {
                                      const current = field.value || [];
                                      const updated = isSelected
                                        ? current.filter((l) => l !== label)
                                        : [...current, label];
                                      field.onChange(updated);
                                    }}
                                  >
                                    {label}
                                  </Badge>
                                );
                              })}
                            </div>
                            <FormDescription>Select labels to highlight this product</FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            Cost Price (₨)
                            <span className="text-xs font-normal text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">Profit auto-calculates</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="bg-background/50 font-bold text-lg border-emerald-300 focus-visible:ring-emerald-400"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-cost-price"
                              placeholder="Enter the price you pay for this product"
                            />
                          </FormControl>
                          <FormDescription>
                            Profit is set automatically based on your{" "}
                            <a href="/admin/profit-rules" className="text-emerald-600 underline underline-offset-2" target="_blank" rel="noopener noreferrer">Profit Rules</a>.
                            You can override it below.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {costPrice > 0 && profitRulesSettings?.rules?.length ? (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                        <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-2">Price Breakdown</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Cost Price</p>
                            <p className="font-bold text-emerald-800">₨ {costPrice.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">+ Profit</p>
                            <p className="font-bold text-emerald-600">₨ {(form.watch("profit") || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">= Selling Price</p>
                            <p className="font-bold text-emerald-700 text-base">₨ {(costPrice + (form.watch("profit") || 0)).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <FormField
                      control={form.control}
                      name="profit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profit (₨) <span className="text-muted-foreground text-xs font-normal">(Auto-calculated, override if needed)</span></FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              className="bg-background/50 font-bold text-lg text-emerald-600"
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-1">Selling Price (Cost + Profit)</p>
                      <p className="text-2xl font-bold text-emerald-700">₨ {(form.watch("price") || 0) + (form.watch("profit") || 0)}</p>
                    </div>
                    <FormField
                      control={form.control}
                      name="originalPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Original Price (₨) <span className="text-muted-foreground text-xs font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              className="bg-background/50 text-muted-foreground"
                              {...field} 
                              value={field.value || ""}
                              onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="pt-2">
                    <FormField
                      control={form.control}
                      name="inStock"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl bg-background/50 p-4 border border-border/50">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Availability</FormLabel>
                            <p className="text-xs text-muted-foreground">Is this item ready for sale?</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-card/50 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Organization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-emerald-900">Category</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val)} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background/50 border-emerald-100 focus:ring-emerald-500">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map((category) => (
                              <SelectItem key={category.id} value={String(category.id)}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-green-50/30 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-emerald-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    AI Tools
                  </CardTitle>
                  <CardDescription className="text-xs">Generate content with AI to boost conversions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1.5 pb-1">
                    <label
                      htmlFor="ai-extra-details"
                      className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/80"
                    >
                      Product details (optional)
                    </label>
                    <Textarea
                      id="ai-extra-details"
                      value={aiExtraDetails}
                      onChange={(e) => setAiExtraDetails(e.target.value)}
                      placeholder={`Add any specs the AI can't see in images, e.g.:\n- Fabric: cotton lawn\n- Sizes: S, M, L, XL\n- Chest: 40", Length: 42"\n- Stitching: machine\n- Origin: Lahore`}
                      className="min-h-[110px] text-xs bg-background/80 border-emerald-200 focus-visible:ring-emerald-500 placeholder:text-emerald-700/40"
                      data-testid="input-ai-extra-details"
                    />
                    <p className="text-[10px] text-emerald-700/60">
                      AI will use these as ground truth in the Product Details section.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full justify-center gap-2 text-sm h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-200/50 hover-elevate"
                    onClick={handleGenerateFullContent}
                    disabled={isAIFullContentLoading}
                    data-testid="button-ai-full-content"
                  >
                    {isAIFullContentLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isAIFullContentLoading ? "Analyzing images…" : "Generate All Content"}
                  </Button>
                  <p className="text-[11px] text-emerald-700/70 px-1 pb-1">
                    Reads your product images plus any details above to fill name, descriptions, and features.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 text-xs h-9 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={handleGenerateDescription}
                    disabled={isAIDescLoading}
                    data-testid="button-ai-desc-sidebar"
                  >
                    {isAIDescLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
                    {isAIDescLoading ? "Generating description…" : "Generate Description"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 text-xs h-9 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={handleGenerateSEO}
                    disabled={isAISEOLoading}
                    data-testid="button-ai-seo-sidebar"
                  >
                    {isAISEOLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
                    {isAISEOLoading ? "Generating SEO…" : "Generate SEO Meta"}
                  </Button>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 text-xs h-9 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                      onClick={handleGenerateReviews}
                      disabled={isAIReviewsLoading}
                      data-testid="button-ai-reviews-sidebar"
                    >
                      {isAIReviewsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
                      {isAIReviewsLoading ? "Generating reviews…" : "Generate AI Reviews (5)"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 sticky bottom-4 z-50">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold shadow-lg shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700 text-white transition-all active:scale-[0.98]" 
                  disabled={mutation.isPending}
                  data-testid="button-save-product"
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  {isEditing ? "Save Changes" : "Publish Product"}
                </Button>
                <Link href="/admin/products">
                  <Button variant="ghost" type="button" className="w-full h-11 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold transition-colors">
                    Cancel & Discard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
