import React from 'react';
import { Mail, MessageCircle, Phone, ArrowLeft, ShieldCheck, LifeBuoy, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/lib/utils';

export default function Support() {
  const supportChannels = [
    {
      title: "Live Chat",
      description: "Chat with our support team in real-time.",
      icon: MessageCircle,
      action: "Start Chat",
      color: "bg-blue-500",
    },
    {
      title: "Email Support",
      description: "Send us an email and we'll get back to you within 24 hours.",
      icon: Mail,
      action: "Send Email",
      color: "bg-indigo-600",
    },
    {
      title: "Phone Support",
      description: "Call us for urgent matters during business hours.",
      icon: Phone,
      action: "Call Now",
      color: "bg-green-600",
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link 
        to={createPageUrl("Home")} 
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>

      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">How can we help?</h1>
        <p className="text-slate-500 max-w-lg mx-auto font-medium">
          Our dedicated support team is here to ensure you have the best experience on IQON.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {supportChannels.map((channel, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center flex flex-col items-center">
            <div className={`w-14 h-14 rounded-2xl ${channel.color} flex items-center justify-center text-white mb-6 shadow-lg shadow-slate-200`}>
              <channel.icon className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg mb-2">{channel.title}</h3>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              {channel.description}
            </p>
            <Button className="w-full rounded-xl font-bold bg-slate-900 hover:bg-black text-white">
              {channel.action}
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-indigo-600 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full mb-6">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">Buyer Protection</span>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">Your security is our top priority</h2>
            <p className="text-white/80 text-sm font-medium leading-relaxed mb-6">
              Every transaction on IQON is protected. If you don't receive your item or it's not as described, we've got you covered.
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
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2rem] p-8">
            <h4 className="font-black mb-4">Frequently Asked Questions</h4>
            <div className="space-y-4">
              {[
                "How do I track my order?",
                "What is the return policy?",
                "How do I become a vendor?",
                "Are my payments secure?"
              ].map((q, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer pb-3 border-b border-white/10 last:border-0 last:pb-0">
                  <span className="text-sm font-bold group-hover:text-indigo-200 transition-colors">{q}</span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-white/40 group-hover:text-white transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
