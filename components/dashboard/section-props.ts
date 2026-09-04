/**
 * Shared shape for the dashboard's independently-loaded sections.
 *
 * `hideEmpty` is set while the first-run checklist is on screen. The checklist
 * owns the calls to action then, so a section with nothing to show returns
 * null instead of stacking another empty state with the same buttons under it.
 */
export interface DashboardSectionProps {
  hideEmpty?: boolean;
}
