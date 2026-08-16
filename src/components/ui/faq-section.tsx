import React, { useState } from 'react';
import { faqs } from '../../data/faqData';
import { motion, AnimatePresence } from 'framer-motion';
import { Bucket } from './bucket';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-transparent border-t border-slate-200/60 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Frequently Asked Questions</h2>
        </div>

        <div className="flex justify-center w-full">
          <Bucket onOpenFullFaq={() => setShowModal(true)} />
        </div>
      </div>

      {/* Full-screen FAQ Modal Overlay */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">Full FAQ Directory</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">Everything you need to know about SkillBridge rules and guidelines.</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {faqs.map((faq, index) => (
                  <div 
                    key={index} 
                    className={`border transition-colors duration-200 rounded-xl bg-slate-800/50 overflow-hidden ${openIndex === index ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-white/5 hover:border-white/10'}`}
                  >
                    <button
                      className="w-full px-5 py-4 text-left flex justify-between items-center focus:outline-none"
                      onClick={() => toggle(index)}
                    >
                      <span className="font-semibold text-white text-sm sm:text-base pr-6">{faq.question}</span>
                      <span className={`transform transition-transform duration-200 text-gray-400 shrink-0 ${openIndex === index ? 'rotate-180 text-purple-400' : ''}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {openIndex === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-5 pb-4 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-slate-950/40 text-center text-xs text-slate-500">
                Click outside this card or press the close button to return to the dashboard.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
