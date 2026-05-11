import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Link } from "wouter";
import { useAuthStore } from "@/store/authStore";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Truck,
  BadgeCheck,
  TrendingUp,
  Wallet,
  HeadphonesIcon,
  CheckCircle2,
  Search,
  Clock,
  XCircle,
  LayoutDashboard,
  MapPin,
  AlertCircle,
  Rocket,
  Phone,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

const PLATFORMS = [
  "Facebook Page",
  "Instagram",
  "WhatsApp Business",
  "OLX",
  "Daraz",
  "TikTok Shop",
  "Personal Website",
  "Other",
];

const CITIES = [
  // Punjab
  "Lahore", "Faisalabad", "Rawalpindi", "Gujranwala", "Multan",
  "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Jhang",
  "Rahim Yar Khan", "Gujrat", "Kasur", "Okara", "Sahiwal",
  "Wazirabad", "Mandi Bahauddin", "Narowal", "Pakpattan", "Mianwali",
  "Bahawalnagar", "Toba Tek Singh", "Khanewal", "Muzaffargarh", "Vehari",
  "Lodhran", "Layyah", "Dera Ghazi Khan", "Bhakkar", "Hafizabad",
  "Attock", "Chakwal", "Jhelum", "Khushab", "Chiniot",
  "Nankana Sahib", "Rajanpur", "Vihari",
  // Sindh
  "Karachi", "Hyderabad", "Sukkur", "Larkana", "Mirpur Khas",
  "Nawabshah", "Jacobabad", "Shikarpur", "Khairpur", "Dadu",
  "Thatta", "Badin", "Tando Adam", "Tando Allahyar", "Umerkot",
  "Kashmore", "Kandhkot", "Sanghar", "Matiari", "Jamshoro",
  "Ghotki", "Qambar Shahdadkot",
  // Khyber Pakhtunkhwa
  "Peshawar", "Mardan", "Mingora", "Abbottabad", "Mansehra",
  "Kohat", "Nowshera", "Charsadda", "Dera Ismail Khan", "Bannu",
  "Haripur", "Swabi", "Hangu", "Karak", "Lakki Marwat",
  "Tank", "Chitral", "Malakand", "Timergara", "Saidu Sharif",
  "Batkhela", "Buner",
  // Balochistan
  "Quetta", "Turbat", "Khuzdar", "Chaman", "Gwadar",
  "Hub", "Sibi", "Zhob", "Loralai", "Dalbandin",
  "Dera Allah Yar", "Kharan", "Mastung", "Kalat", "Panjgur",
  "Nushki", "Bela", "Dera Murad Jamali",
  // Islamabad Capital Territory
  "Islamabad",
  // Azad Kashmir
  "Muzaffarabad", "Mirpur", "Rawalakot", "Bagh", "Kotli",
  "Pallandri", "Bhimber",
  // Gilgit-Baltistan
  "Gilgit", "Skardu", "Hunza", "Chilas", "Ghanche",
  "Other",
];

const formSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  city: z.string().min(1, "Please select your city"),
  storeUrl: z.string().optional(),
  platform: z.string().min(1, "Please select your selling platform"),
  monthlyOrders: z.string().min(1, "Please select your expected monthly orders"),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const benefits = [
  {
    icon: Package,
    title: "No Inventory Needed",
    description:
      "List our products on your store without buying any stock. Zero upfront investment required.",
  },
  {
    icon: Truck,
    title: "We Handle Shipping",
    description:
      "We pack and ship every order directly to your customer. You never touch the product.",
  },
  {
    icon: BadgeCheck,
    title: "Proven Products",
    description:
      "25,000+ happy customers. Every product we offer has already been tested in the Pakistani market.",
  },
  {
    icon: TrendingUp,
    title: "Real Profit Margins",
    description:
      "Set your own prices and keep the difference. Competitive wholesale prices so you always profit.",
  },
  {
    icon: Wallet,
    title: "Zero Risk",
    description:
      "No sale, no loss. You only pay for a product after your customer has already paid you.",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description:
      "Our team is always available to help you with orders, tracking, and any product questions.",
  },
];

const steps = [
  {
    number: "01",
    title: "Register Below",
    description: "Fill out the short form below to apply for the program.",
  },
  {
    number: "02",
    title: "Get Approved",
    description:
      "Our team reviews your application within 24 hours and sends you the product catalog.",
  },
  {
    number: "03",
    title: "List Products",
    description:
      "Add PakCart products to your store with our ready-made images and descriptions.",
  },
  {
    number: "04",
    title: "Earn on Every Sale",
    description:
      "When an order comes in, forward it to us. We ship it. You keep the profit.",
  },
];

const faqs = [
  {
    q: "Is there any joining fee?",
    a: "No. The PakCart Dropshipper Program is completely free to join. There are no hidden charges.",
  },
  {
    q: "How much profit can I make?",
    a: "Profit margins vary by product, typically between Rs. 200 – Rs. 800 per item. You set your own selling price.",
  },
  {
    q: "When and how do I get paid?",
    a: "You collect payment from your customer first, then place the order with us at the wholesale price. The difference is your profit — you keep it immediately.",
  },
  {
    q: "Do I need a registered business?",
    a: "No. You can join as an individual. All you need is a platform to sell on — a Facebook page, Instagram, or WhatsApp group works.",
  },
  {
    q: "How fast do you ship?",
    a: "We dispatch within 1–2 business days after you place the order. Delivery takes 2–5 days depending on the city.",
  },
  {
    q: "What if a customer wants to return a product?",
    a: "We handle returns and replacements directly. Contact our support team with the order details and we'll resolve it.",
  },
];

export default function Dropshipper() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusEmail, setStatusEmail] = useState("");
  const [statusResult, setStatusResult] = useState<null | { status: string; fullName: string }>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  async function checkStatus() {
    if (!statusEmail) return;
    setStatusChecking(true);
    setStatusResult(null);
    try {
      const q = query(
        collection(db, "dropshipper_applications"),
        where("email", "==", statusEmail.toLowerCase().trim()),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast({
          title: "No application found",
          description: "No application found for this email address.",
          variant: "destructive",
        });
      } else {
        const data = snap.docs[0].data();
        setStatusResult({ status: data.status, fullName: data.fullName });
      }
    } catch {
      toast({ title: "Error checking status", variant: "destructive" });
    } finally {
      setStatusChecking(false);
    }
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      city: "",
      storeUrl: "",
      platform: "",
      monthlyOrders: "",
      message: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const emailLower = values.email.toLowerCase().trim();
      const existing = await getDocs(
        query(
          collection(db, "dropshipper_applications"),
          where("email", "==", emailLower),
          limit(1)
        )
      );
      if (!existing.empty) {
        const existingStatus = existing.docs[0].data().status;
        toast({
          title: "Already Applied",
          description:
            existingStatus === "approved"
              ? "This email is already approved. Please log in to access your dashboard."
              : existingStatus === "pending"
              ? "Your application is already under review. We will contact you within 24 hours."
              : "An application with this email already exists. Please contact us for more info.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      await addDoc(collection(db, "dropshipper_applications"), {
        ...values,
        email: emailLower,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      form.reset();
    } catch {
      toast({
        title: "Something went wrong",
        description: "Could not submit your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title="Dropshipper Program - Earn by Selling PakCart Products | PakCart"
        description="Join PakCart's dropshipper program. List proven products on your store — we handle stock, packaging, and delivery. Zero risk, real profit."
        url="https://pakcart.store/dropshipper"
        robots="index,follow"
      />

      {/* Already approved banner */}
      {isAuthenticated && (
        <div className="bg-green-800 text-white py-3 px-4">
          <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <p className="text-xs sm:text-sm text-green-100">
              <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-green-300" />
              Already an approved dropshipper? Access your dashboard.
            </p>
            <Link href="/dropshipper/dashboard">
              <Button
                size="sm"
                className="bg-white text-green-800 hover:bg-green-50 rounded-full h-8 px-4 text-xs font-semibold shrink-0"
                data-testid="btn-go-dashboard"
              >
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-700 to-green-900 text-white">
        <div className="container mx-auto px-4 py-10 sm:py-14 md:py-20 lg:py-24">
          <Breadcrumb className="mb-5 sm:mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="text-green-200 hover:text-white text-xs sm:text-sm">
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-green-400" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-white text-xs sm:text-sm">Dropshipper Program</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-600 text-white text-[10px] sm:text-xs font-semibold px-3 py-1.5 rounded-full mb-4 sm:mb-6">
                <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                NOW OPEN — LIMITED SPOTS
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4 sm:mb-6 text-white">
                Sell PakCart Products.{" "}
                <span className="text-green-300">We Handle Everything Else.</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-green-100 mb-6 sm:mb-8">
                Join Pakistan's fastest-growing dropshipper program. List our proven products
                on your store, bring the customer — and we take care of stock, packaging, and
                delivery. Zero risk. Real profit.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="#register" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-white text-green-800 hover:bg-green-50 active:bg-green-100 rounded-full px-6 sm:px-8 font-semibold text-sm sm:text-base"
                    data-testid="btn-register-hero"
                  >
                    Register Now — It's Free
                  </Button>
                </a>
                <a
                  href="https://wa.me/923188055850"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-green-300 text-white hover:bg-green-800 active:bg-green-800 rounded-full px-6 sm:px-8 text-sm sm:text-base"
                    data-testid="btn-whatsapp-hero"
                  >
                    <SiWhatsapp className="h-4 w-4 mr-2" /> WhatsApp Us
                  </Button>
                </a>
              </div>
            </div>

            <div className="hidden lg:grid grid-cols-2 gap-4">
              {[
                { label: "Happy Customers", value: "25,000+" },
                { label: "Active Dropshippers", value: "15+" },
                { label: "Products Available", value: "150+" },
                { label: "Avg. Profit/Order", value: "Rs. 400+" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-green-800/50 border border-green-600/40 rounded-xl p-5 text-center"
                >
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-sm text-green-300 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar (mobile + tablet) */}
        <div className="border-t border-green-600/40 bg-green-900/50">
          <div className="container mx-auto px-4 py-4 sm:py-5 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center lg:hidden">
            {[
              { value: "25,000+", label: "Happy Customers" },
              { value: "15+", label: "Active Dropshippers" },
              { value: "150+", label: "Products Available" },
              { value: "PKR 0", label: "Upfront Cost" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xl sm:text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs sm:text-sm text-green-300">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Status Checker */}
      <section className="py-8 sm:py-10 bg-white border-b">
        <div className="container mx-auto px-4 max-w-lg text-center">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Already Applied?</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">
            Enter your email address to check the status of your application.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="email"
                placeholder="your@email.com"
                className="pl-9 text-sm"
                value={statusEmail}
                onChange={(e) => setStatusEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkStatus()}
                data-testid="input-status-email"
              />
            </div>
            <Button
              onClick={checkStatus}
              disabled={statusChecking || !statusEmail}
              className="bg-green-700 hover:bg-green-800 text-white rounded-full px-4 sm:px-5 text-sm shrink-0"
              data-testid="button-check-status"
            >
              {statusChecking ? "..." : "Check"}
            </Button>
          </div>

          {statusResult && (
            <div
              className={`mt-4 rounded-xl p-3 sm:p-4 border text-sm ${
                statusResult.status === "approved"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : statusResult.status === "rejected"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
              }`}
              data-testid="status-result"
            >
              <div className="flex items-center justify-center gap-2 font-semibold mb-1 text-sm">
                {statusResult.status === "approved" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {statusResult.status === "pending" && <Clock className="h-4 w-4 shrink-0" />}
                {statusResult.status === "rejected" && <XCircle className="h-4 w-4 shrink-0" />}
                <span className="truncate">{statusResult.fullName}</span> —{" "}
                {statusResult.status.charAt(0).toUpperCase() + statusResult.status.slice(1)}
              </div>
              {statusResult.status === "approved" && (
                <Link href="/dropshipper/dashboard">
                  <Button
                    size="sm"
                    className="mt-2 bg-green-700 hover:bg-green-800 text-white rounded-full px-5 h-8 text-xs"
                    data-testid="btn-go-to-dashboard"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Go to Dashboard
                  </Button>
                </Link>
              )}
              {statusResult.status === "pending" && (
                <p className="text-xs mt-1 opacity-80">
                  We will contact you within 24 hours.
                </p>
              )}
              {statusResult.status === "rejected" && (
                <p className="text-xs mt-1 opacity-80">
                  Contact us at contact@pakcart.store for more info.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-10 sm:py-14 lg:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Why Dropship with PakCart?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              We've built the infrastructure so you can focus only on what matters — making
              sales.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="bg-white rounded-xl p-4 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                  <benefit.icon className="h-4 w-4 sm:h-5 sm:w-5 text-green-700" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5 sm:mb-2 text-sm sm:text-base">{benefit.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-10 sm:py-14 lg:py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">How It Works</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              From registration to your first sale in as little as 48 hours.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(100%-12px)] w-1/2 h-px bg-green-200 z-0" />
                )}
                <div className="relative z-10 flex items-start gap-4 sm:block">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-green-700 text-white flex items-center justify-center font-bold text-base sm:text-lg shrink-0 sm:mb-4">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{step.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Catalog CTA */}
      <section className="py-10 sm:py-12 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-100 mb-4 sm:mb-5">
            <Package className="h-6 w-6 sm:h-7 sm:w-7 text-green-700" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">See What You'll Be Selling</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mb-5 sm:mb-6 px-2">
            Browse our full product listing. Hover over any product and click the download icon to
            export its complete details — name, description, price, images and more — as a
            professionally formatted .txt file. Or export the entire catalog in one click.
          </p>
          <Link href="/products">
            <Button
              size="lg"
              className="bg-green-700 hover:bg-green-800 active:bg-green-900 text-white rounded-full px-7 sm:px-10 font-semibold gap-2 text-sm sm:text-base w-full sm:w-auto"
              data-testid="btn-browse-catalog"
            >
              <Package className="h-4 w-4 sm:h-5 sm:w-5" />
              Browse &amp; Export Products
            </Button>
          </Link>
        </div>
      </section>

      {/* Profit Calculator Teaser */}
      <section className="py-10 sm:py-12 bg-green-700 text-white">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 sm:mb-4 text-green-300" />
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">What Could You Earn?</h2>
          <p className="text-xs sm:text-sm text-green-200 mb-5 sm:mb-6 leading-relaxed">
            If you sell just 10 orders a month with an average profit of Rs. 400 per item —
            that's <strong className="text-white">Rs. 4,000/month</strong> in pure profit. Scale
            to 50 orders and you're at <strong className="text-white">Rs. 20,000/month</strong>.
            All from your phone.
          </p>
          <a href="#register" className="block sm:inline-block">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-white text-green-800 hover:bg-green-50 active:bg-green-100 rounded-full px-8 sm:px-10 font-semibold text-sm sm:text-base"
            >
              Start Earning Today
            </Button>
          </a>
        </div>
      </section>

      {/* Registration Form */}
      <section id="register" className="py-10 sm:py-14 lg:py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Apply to Join</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Free to join. Takes less than 2 minutes. We'll review and respond within 24
              hours.
            </p>
          </div>

          {submitted ? (
            <div
              className="bg-green-50 border border-green-200 rounded-2xl p-6 sm:p-8 text-center"
              data-testid="success-message"
            >
              <CheckCircle2 className="h-12 w-12 sm:h-14 sm:w-14 text-green-600 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-green-900 mb-2">
                Application Submitted!
              </h3>
              <p className="text-sm text-green-700 mb-2">
                Thank you for applying. Our team will review your application and contact you
                within 24 hours on WhatsApp.
              </p>
              <p className="text-xs text-green-600">
                In the meantime, use the status checker above to track your application.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border shadow-sm p-4 sm:p-6 md:p-8">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                  data-testid="form-dropshipper-apply"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" data-testid="input-full-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Phone / WhatsApp *</FormLabel>
                          <FormControl>
                            <Input placeholder="+92 3XX XXXXXXX" data-testid="input-phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" data-testid="input-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">City *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your city"
                              data-testid="input-city"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs sm:text-sm">Selling Platform *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-platform">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PLATFORMS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="monthlyOrders"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Expected Monthly Orders *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-monthly-orders">
                              <SelectValue placeholder="How many orders per month?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1-10">1–10 orders</SelectItem>
                            <SelectItem value="11-30">11–30 orders</SelectItem>
                            <SelectItem value="31-50">31–50 orders</SelectItem>
                            <SelectItem value="50+">50+ orders</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="storeUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Store/Page Link (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://facebook.com/yourpage"
                            data-testid="input-store-url"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs sm:text-sm">Anything to add? (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us about your experience or why you want to join..."
                            rows={3}
                            className="resize-none text-sm"
                            data-testid="input-message"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    One application per email address. Use the status checker above if you've already applied.
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 bg-green-700 hover:bg-green-800 active:bg-green-900 text-white text-sm sm:text-base font-semibold rounded-full"
                    disabled={isSubmitting}
                    data-testid="button-submit-apply"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application — Free"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 sm:py-14 lg:py-16 bg-white">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-7 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Frequently Asked Questions
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border rounded-xl px-4 sm:px-5 shadow-sm"
              >
                <AccordionTrigger className="text-left font-semibold text-gray-900 text-xs sm:text-sm py-3 sm:py-4 hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground pb-3 sm:pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* E-commerce Platform Promo */}
      <section className="py-10 sm:py-14 bg-gradient-to-br from-amber-50 to-orange-50 border-y border-amber-200">
        <div className="container mx-auto px-4 max-w-3xl">

          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 mb-3 sm:mb-4">
              <Rocket className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Apna Online Store Banana Chahte Hain?
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-lg mx-auto leading-relaxed">
              Koi coding nahi. Koi technical kaam nahi. Bas WhatsApp karein — baaki sab hum karte hain.
            </p>
          </div>

          {/* Simple 3 Steps */}
          <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10">
            {[
              {
                step: "1",
                icon: Phone,
                title: "WhatsApp Karen",
                detail: "Hum se contact karen aur batayein ke aap kya sell karna chahte hain — kapre, accessories, ya kuch bhi.",
              },
              {
                step: "2",
                icon: Globe,
                title: "Hum Aap Ka Store Banate Hain",
                detail: "Hum aap ki website design karte hain, products dalete hain, aur sab set up karte hain. Aap ko kuch nahi karna — sirf approve karna hai.",
              },
              {
                step: "3",
                icon: ShieldCheck,
                title: "Aap Sell Karna Shuru Karen",
                detail: "Aap ka store live ho jata hai. Customers order dete hain, aap payment lete hain. Hum hamesha help ke liye available hain.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-4 sm:p-5 border border-amber-100 shadow-sm flex items-start gap-4">
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500 text-white font-bold text-base sm:text-lg flex items-center justify-center shadow-sm">
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-1">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{item.detail}</p>
                </div>
                <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50">
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                </div>
              </div>
            ))}
          </div>

          {/* What you get */}
          <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4 sm:p-5 mb-7 sm:mb-8">
            <p className="font-semibold text-gray-800 text-sm sm:text-base mb-3">Aap Ko Milega:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Aap ke naam ki apni website",
                "Day 1 se orders lene ki ability",
                "Products, photos, prices — sab set up",
                "24/7 WhatsApp support hum se",
                "Koi coding ya tech knowledge zaroor nahi",
                "Pakistan mein delivery ready setup",
              ].map((point) => (
                <div key={point} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                  <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </div>
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Shuru karna bohat aasaan hai — bas ek message bhejein. 👇
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://wa.me/923188055850"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-full px-6 sm:px-8 font-semibold gap-2 text-sm sm:text-base"
                >
                  <SiWhatsapp className="h-4 w-4" /> WhatsApp Us — +92 318 8055850
                </Button>
              </a>
              <Link href="/web-development" className="block w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-amber-400 text-amber-700 hover:bg-amber-50 active:bg-amber-100 rounded-full px-6 sm:px-8 font-semibold gap-2 text-sm sm:text-base"
                >
                  <Globe className="h-4 w-4" /> Web Development Details
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-10 sm:py-12 bg-green-700">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
            Ready to Start Earning?
          </h2>
          <p className="text-xs sm:text-sm text-green-200 mb-5 sm:mb-6 max-w-md mx-auto">
            Join hundreds of Pakistani entrepreneurs already earning with PakCart.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white text-green-800 hover:bg-green-50 active:bg-green-100 rounded-full px-7 sm:px-8 font-semibold text-sm sm:text-base"
              >
                Apply Now — It's Free
              </Button>
            </a>
            <a
              href="https://wa.me/923188055850"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-green-300 text-white hover:bg-green-800 active:bg-green-800 rounded-full px-7 sm:px-8 text-sm sm:text-base"
              >
                <SiWhatsapp className="h-4 w-4 mr-2" /> Chat on WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
