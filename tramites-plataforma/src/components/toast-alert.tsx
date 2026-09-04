"use client";

import { useEffect, useState } from "react";

type ToastAlertProps = {
  show: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
};

export function ToastAlert({ show, title, message, onDismiss }: ToastAlertProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 6000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-4 animate-pulse">
      <div className="rounded-2xl border-4 border-red-600 bg-gradient-to-r from-red-500 to-red-600 text-white p-4 shadow-2xl">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-white hover:text-red-100 text-xl font-bold cursor-pointer"
        >
          ✕
        </button>
        <p className="text-sm font-bold uppercase tracking-wider">{title}</p>
        <p className="text-lg font-bold mt-1">{message}</p>
      </div>
    </div>
  );
}
