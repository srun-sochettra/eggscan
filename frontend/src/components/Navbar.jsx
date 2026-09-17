import { Link, useLocation } from 'react-router-dom';
import { IconBrokenEgg } from './Icons';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { name: 'Profile Scanner', path: '/' },
    { name: 'Commit Shame', path: '/commit-shame' },
    { name: 'README Rater', path: '/readme-rater' },
    { name: 'Stack Roast', path: '/stack-roast' },
  ];

  return (
    <nav className="bg-white/50 border-b border-brown-300 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <IconBrokenEgg size={24} />
              <span className="font-display font-bold text-xl text-brown-700">EggScan</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'border-brown-700 text-brown-700'
                      : 'border-transparent text-brown-500 hover:border-brown-300 hover:text-brown-700'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile menu - simplified for now, could add hamburger if needed */}
          <div className="flex sm:hidden overflow-x-auto items-center space-x-4 pl-4 hide-scrollbar">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`whitespace-nowrap text-sm font-medium ${
                    location.pathname === link.path
                      ? 'text-brown-700 border-b-2 border-brown-700'
                      : 'text-brown-500 hover:text-brown-700'
                  }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}