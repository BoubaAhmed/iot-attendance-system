import React from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";

const ErrorPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <div className="p-6 rounded-2xl bg-white shadow-md border border-primary-dark/10 max-w-md">
        <div className="text-accent w-20 h-20 rounded-full mx-auto flex items-center justify-center bg-accent/10 mb-4">
          <FiAlertTriangle className="text-accent w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-primary-dark mb-2">
          Page introuvable
        </h1>
        <p className="text-sm text-primary-dark/70 mb-4">
          La page que vous cherchez n'existe pas ou a peut-être été déplacée.
        </p>
        <Link
          to="/"
          className="inline-block px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:brightness-95 transition"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
};

export default ErrorPage;
