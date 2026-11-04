import { THEME_KEY } from "@/components/prefs/keys";

/**
 * Runs before first paint:
 * - applies a saved explicit theme (otherwise CSS follows the system)
 * - marks the page as waiting for the crew, so buildable elements start
 *   unbuilt. Skipped for reduced motion, and released after a few seconds
 *   if the crew never arrives (e.g. a script error), so content always shows.
 */
export function BootScript() {
  const html = `(function(){var d=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(
    THEME_KEY,
  )});if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches){d.setAttribute("data-swarm","pending");setTimeout(function(){if(d.getAttribute("data-swarm")==="pending")d.removeAttribute("data-swarm")},4000)}}catch(e){}})()`;
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
