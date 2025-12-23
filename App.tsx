
import React, { useState } from 'react';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import Instructions from './pages/Instructions';

type Page = 'home' | 'admin' | 'staff' | 'instructions';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<any>(null);

  const navigateTo = (page: Page) => setCurrentPage(page);

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      {currentPage === 'home' && (
        <Home 
          onNavigate={navigateTo} 
        />
      )}
      {currentPage === 'admin' && (
        <AdminDashboard 
          onBack={() => navigateTo('home')} 
        />
      )}
      {currentPage === 'staff' && (
        <StaffDashboard 
          onBack={() => navigateTo('home')}
          employee={currentEmployee}
          setEmployee={setCurrentEmployee}
        />
      )}
      {currentPage === 'instructions' && (
        <Instructions 
          onBack={() => navigateTo('home')} 
        />
      )}

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-gray-400 text-sm border-t bg-white">
        &copy; {new Date().getFullYear()} نظام إدارة المركز الطبي - جميع الحقوق محفوظة
      </footer>
    </div>
  );
};

export default App;
