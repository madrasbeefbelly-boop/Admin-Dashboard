import { NavLink, useLocation } from 'react-router-dom';
import { mobileTabs } from './navigation';

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const activeTab = mobileTabs.findIndex(({ href }) => href === pathname);

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-30 isolate pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-clip drop-shadow-[0_-3px_8px_#0f172a14]">
        {activeTab === -1 ? (
          <div className="size-full bg-white" />
        ) : (
          <div
            className="absolute inset-y-0 flex w-[min(5.75rem,25vw)] -translate-x-1/2 flex-col text-white before:absolute before:inset-y-0 before:right-full before:w-screen before:bg-white after:absolute after:inset-y-0 after:left-full after:w-screen after:bg-white"
            style={{ left: `${(activeTab + 0.5) / mobileTabs.length * 100}%` }}
          >
            <svg viewBox="0 0 92 34" preserveAspectRatio="none" className="h-[34px] w-full shrink-0" fill="currentColor">
              <path d="M0 0C23 0 14 28 46 28S69 0 92 0V34H0Z" />
            </svg>
            <div className="flex-1 bg-white" />
          </div>
        )}
      </div>

      <div className="grid h-16 grid-cols-5">
        {mobileTabs.map(({ name, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            end={href === '/'}
            onClick={() => { if (pathname !== href) window.scrollTo(0, 0); }}
            className="group relative flex min-w-0 items-end justify-center rounded-lg pb-2.5 text-slate-600 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary aria-[current=page]:font-bold aria-[current=page]:text-primary"
          >
            <span className="absolute top-0 grid size-11 place-items-center rounded-full group-aria-[current=page]:-top-5 group-aria-[current=page]:bg-primary group-aria-[current=page]:text-white group-aria-[current=page]:shadow-md">
              <Icon className="size-[21px]" aria-hidden="true" />
            </span>
            <span className="text-[11px] leading-tight">{name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
