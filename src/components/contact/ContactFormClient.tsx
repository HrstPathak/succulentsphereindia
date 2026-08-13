"use client";
import React from "react";
import { Mail, MessageSquareText, Send, UserRound } from "lucide-react";

export default function ContactFormClient() {
  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;

    const mailtoLink = `mailto:support@succulentsphere.com?subject=Customer Inquiry from ${encodeURIComponent(
      name
    )}&body=Name: ${encodeURIComponent(name)}%0AEmail: ${encodeURIComponent(email)}%0A%0AMessage:%0A${encodeURIComponent(
      message
    )}`;

    // Use client-side navigation to open the user's mail client
    window.location.href = mailtoLink;
  }

  return (
    <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto mt-6 bg-white p-4 rounded shadow-sm border border-gray-100">
      <label className="mb-1 flex items-center gap-2 text-sm font-medium"><UserRound size={16} /> Your Name</label>
      <input type="text" name="name" required className="w-full p-2 border rounded mb-3" placeholder="Your name" />

      <label className="mb-1 flex items-center gap-2 text-sm font-medium"><Mail size={16} /> Your Email</label>
      <input type="email" name="email" required className="w-full p-2 border rounded mb-3" placeholder="you@domain.com" />

      <label className="mb-1 flex items-center gap-2 text-sm font-medium"><MessageSquareText size={16} /> Your Message</label>
      <textarea name="message" rows={5} required className="w-full p-2 border rounded mb-3" placeholder="Your message" />

      <div className="text-right">
        <button type="submit" className="inline-flex items-center gap-2 bg-[var(--color-brand)] text-white px-5 py-2 rounded">
          <Send size={15} />
          Send Message
        </button>
      </div>
    </form>
  );
}
