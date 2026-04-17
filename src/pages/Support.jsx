import React, { useState } from 'react';
import { Mail, MessageCircle, ArrowLeft, ShieldCheck, LifeBuoy, Clock, Sparkles, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/lib/utils';
import { reportsAPI } from '@/api/apiClient';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Support() {
  const navigate = useNavigate();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportData, setReportData] = useState({
    reason: '',
    description: '',
  });
  
  const supportChannels = [
    {
      title: "AI Assistant",
      description: "Get instant answers and help with Aicon AI.",
      icon: Sparkles,
      action: "Ask AI",
      color: "bg-pink-500",
      onClick: () => navigate(createPageUrl("AIAssistant")),
    },
    {
      title: "Live Chat",
      description: "Chat with our support team in real-time.",
      icon: MessageCircle,
      action: "Start Chat",
      color: "bg-blue-500",
      onClick: () => navigate(createPageUrl("Chat") + "?to=support"),
    },
    {
      title: "Report Issue",
      description: "Found a bug or have a safety concern? Let us know.",
      icon: Flag,
      action: "Report Now",
      color: "bg-orange-500",
      onClick: () => setIsReportOpen(true),
    },
    {
      title: "Email Support",
      description: "Direct email for business or partnership inquiries.",
      icon: Mail,
      action: "Send Email",
      color: "bg-indigo-600",
      onClick: () => window.location.href = 'mailto:support@iqon.ai',
    }
  ];

  const handleReportSubmit = async () => {
    if (!reportData.reason) {
      toast.error("Please select a reason for your report");
      return;
    }

    setIsSubmitting(true);
    try {
      await reportsAPI.create({
        target_id: "000000000000000000000000", // System/General report ID
        target_type: "user", // Default for general reports
        reason: reportData.reason,
        description: reportData.description
      });
      toast.success("Report submitted successfully! We will review it shortly.");
      setIsReportOpen(false);
      setReportData({ reason: '', description: '' });
    } catch (error) {
      toast.error(error.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      q: "How do I track my order?",
      a: "You can track your order by visiting the 'Orders' page in your profile and clicking on the specific order. You'll see real-time updates and a tracking number if applicable."
    },
    {
      q: "What is the return policy?",
      a: "We offer a 14-day return policy for most items. If you're not satisfied, you can initiate a return from the 'Order Detail' page. Items must be in their original condition."
    },
    {
      q: "How do I become a vendor?",
      a: "Simply go to 'My Store' in the navigation menu and follow the setup instructions. You'll need to provide some basic information and verify your identity."
    },
    {
      q: "Are my payments secure?",
      a: "Yes, all payments are processed through secure, encrypted gateways like Paystack. We never store your full card details on our servers."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link 
        to={createPageUrl("Home")} 
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>

      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">How can we help?</h1>
        <p className="text-slate-500 max-w-lg mx-auto font-medium">
          Our dedicated support team is here to ensure you have the best experience on Aicon X.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {supportChannels.map((channel, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center flex flex-col items-center group hover:border-indigo-100 transition-all">
            <div className={`w-14 h-14 rounded-2xl ${channel.color} flex items-center justify-center text-white mb-6 shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform`}>
              <channel.icon className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg mb-2">{channel.title}</h3>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed flex-1">
              {channel.description}
            </p>
            <Button 
              onClick={channel.onClick}
              className="w-full rounded-xl font-bold bg-slate-900 hover:bg-black text-white"
            >
              {channel.action}
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-indigo-600 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full mb-6">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">Buyer Protection</span>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">Your security is our top priority</h2>
            <p className="text-white/80 text-sm font-medium leading-relaxed mb-6">
              Every transaction on Aicon X is protected. If you don't receive your item or it's not as described, we've got you covered.
            </p>
            <div className="flex flex-wrap gap-4">
               <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-200" />
                  <span className="text-xs font-bold">24/7 Monitoring</span>
               </div>
               <div className="flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-indigo-200" />
                  <span className="text-xs font-bold">Priority Support</span>
               </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2.5rem] p-6 md:p-8">
            <h4 className="font-black mb-6 text-lg">Frequently Asked Questions</h4>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-white/10 border-b last:border-0">
                  <AccordionTrigger className="text-sm font-bold py-4 hover:text-indigo-200 hover:no-underline text-left">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-indigo-100 text-xs leading-relaxed font-medium pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Report an Issue</DialogTitle>
            <DialogDescription className="font-medium">
              Tell us what's wrong. We'll investigate and take appropriate action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-bold">What is the issue about?</Label>
              <Select onValueChange={(v) => setReportData({ ...reportData, reason: v })} value={reportData.reason}>
                <SelectTrigger id="reason" className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Bug Report">Bug Report</SelectItem>
                  <SelectItem value="Safety Concern">Safety Concern</SelectItem>
                  <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                  <SelectItem value="Vendor Issue">Vendor Issue</SelectItem>
                  <SelectItem value="Feedback">General Feedback</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold">Details</Label>
              <Textarea
                id="description"
                placeholder="Provide more details so we can help faster..."
                className="min-h-[120px] rounded-xl border-slate-200 resize-none"
                value={reportData.description}
                onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsReportOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReportSubmit}
              disabled={isSubmitting}
              className="bg-slate-900 hover:bg-black text-white rounded-xl font-bold px-8"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
