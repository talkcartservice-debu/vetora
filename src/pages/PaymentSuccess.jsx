import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyPayment } from '@/lib/paystack';
import { createPageUrl } from '@/lib/utils';
import { toast } from 'sonner';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      if (!reference) {
        setStatus('error');
        return;
      }

      try {
        const response = await verifyPayment(reference);
        if (response.status && response.data.status === 'success') {
          setStatus('success');
          toast.success('Payment verified successfully!');
        } else {
          setStatus('error');
          toast.error('Payment verification failed');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        toast.error('An error occurred during verification');
      }
    };

    verify();
  }, [reference]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-slate-100 p-8 text-center shadow-2xl shadow-slate-200/50">
        {status === 'verifying' && (
          <div className="py-12">
            <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Verifying Payment</h1>
            <p className="text-slate-500 font-medium">Please wait while we confirm your transaction...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-8">
            <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-green-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Payment Successful!</h1>
            <p className="text-slate-500 font-medium mb-8">
              Thank you for your purchase. Your order has been confirmed and is being processed.
            </p>
            <div className="grid gap-3">
              <Button asChild className="bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold w-full">
                <Link to={createPageUrl("Orders")}>
                  View My Orders <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-xl font-bold w-full border-slate-200">
                <Link to={createPageUrl("Marketplace")}>
                  Continue Shopping <ShoppingBag className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-8">
            <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-600">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Verification Failed</h1>
            <p className="text-slate-500 font-medium mb-8">
              We couldn't verify your payment reference. If you were charged, please contact support.
            </p>
            <Button asChild variant="outline" className="h-12 rounded-xl font-bold w-full border-slate-200">
              <Link to={createPageUrl("Checkout")}>
                Try Again
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
