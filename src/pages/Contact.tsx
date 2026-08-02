import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Briefcase, Phone, MessageCircle, Globe, MapPin, Send, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";
import Header from "@/components/Header";
import SEOHead from "@/components/SEOHead";
import AdSense from "@/components/AdSense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const contactSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

type ContactForm = z.infer<typeof contactSchema>;

const CONTACTS = [
  { icon: Mail, label: "Email", value: "infosearchpoi@gmail.com", href: "mailto:infosearchpoi@gmail.com" },
  { icon: Phone, label: "Call Line", value: "+2348114472622", href: "tel:+2348114472622" },
  { icon: MessageCircle, label: "WhatsApp", value: "+234 9167113584", href: "https://wa.me/2349167113584" },
  { icon: Globe, label: "Website", value: "searchpoi.lovable.app", href: "https://searchpoi.lovable.app/" },
  { icon: Briefcase, label: "Business Inquiries", value: "businesssearchpoi@gmail.com", href: "mailto:businesssearchpoi@gmail.com" },
  { icon: MapPin, label: "Office", value: "Lagos, Nigeria 🇳🇬", href: undefined },
];

const Contact = () => {
  const [form, setForm] = useState<ContactForm>({ full_name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name as keyof ContactForm]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as keyof ContactForm] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setStatus("loading");
    const { error } = await api.from("contact_messages").insert([{
      full_name: result.data.full_name,
      email: result.data.email,
      subject: result.data.subject,
      message: result.data.message,
    }]);
    if (error) {
      setStatus("error");
    } else {
      setStatus("success");
      setForm({ full_name: "", email: "", subject: "", message: "" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Contact SEARCH-POI — Get In Touch" description="Contact the SEARCH-POI team for feedback, partnerships, or support. We'd love to hear from you." path="/contact" />
      <Header />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Title */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Contact <span className="gradient-text">SEARCH-POI</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We'd love to hear from you 💙 Whether you have feedback, feature requests, partnership inquiries, or technical support needs, feel free to reach out.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Contact Info */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-2 space-y-4">
              {CONTACTS.map((c) => {
                const Wrapper = c.href ? "a" : "div";
                return (
                  <Wrapper key={c.label} {...(c.href ? { href: c.href, target: c.href.startsWith("http") ? "_blank" : undefined, rel: c.href.startsWith("http") ? "noopener noreferrer" : undefined } : {})} className="glass rounded-xl p-4 flex items-start gap-3 border border-border/30 block hover:border-primary/40 transition-colors">
                    <c.icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-sm font-medium text-foreground break-all">{c.value}</p>
                    </div>
                  </Wrapper>
                );
              })}
            </motion.div>

            {/* Form */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 sm:p-8 border border-border/30 space-y-5">
                <h2 className="text-xl font-bold text-foreground mb-2">Send a Message</h2>

                {status === "success" && (
                  <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg p-3">
                    <CheckCircle className="w-4 h-4" /> Message sent successfully! We'll get back to you soon.
                  </div>
                )}
                {status === "error" && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4" /> Something went wrong. Please try again.
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                    <Input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Your name" className="bg-background/50" />
                    {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
                    <Input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@email.com" className="bg-background/50" />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                  <Input name="subject" value={form.subject} onChange={handleChange} placeholder="What's this about?" className="bg-background/50" />
                  {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                  <Textarea name="message" value={form.message} onChange={handleChange} placeholder="Your message…" rows={5} className="bg-background/50" />
                  {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
                </div>

                <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto gap-2">
                  <Send className="w-4 h-4" />
                  {status === "loading" ? "Sending…" : "Send Message"}
                </Button>
              </form>
            </motion.div>
          </div>

          <AdSense adSlot="9944378861" adFormat="auto" className="mt-10" />

          {/* Footer credit */}
          <div className="text-center text-xs text-muted-foreground mt-12">
            <p>SEARCH-POI • Created & Owned by <span className="text-foreground">Prosper Ozoya Irhebhude</span></p>
            <p className="mt-1">Founder of <span className="text-primary">POI FOUNDATION</span></p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Contact;
