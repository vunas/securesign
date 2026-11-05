"use client";

export default function Footer() {
  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-white border-t border-slate-200 py-8 md:py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
        <div className="flex items-center space-x-3">
          <div
            className="flex items-center space-x-3 group cursor-pointer"
            onClick={scrollToTop}
          >
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 md:p-2.5 rounded-xl shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all duration-300">
              <i className="fa-solid fa-file-signature text-xl"></i>
            </div>
            <span className="font-extrabold text-xl md:text-2xl tracking-tight text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-500 font-medium text-center md:text-left order-3 md:order-none">
          &copy; 2026 by <span className="font-semibold text-gray-900">SecureSign</span>. All rights reserved.
        </p>

        <div className="flex space-x-4 md:space-x-5 order-2 md:order-none">
          <a
            href="https://github.com/Vunas/digital-signature-system"
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Repository"
          >
            <i className="fa-brands fa-github text-lg"></i>
          </a>
        </div>
      </div>
    </footer>
  );
}

