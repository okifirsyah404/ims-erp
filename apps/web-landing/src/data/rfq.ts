/** RFQ flow content (03.02 RFQ & Pricing). Only step 2 is drawn in the design. */
export const rfqSteps = [
  { id: 1, label: "Company" },
  { id: 2, label: "Project & items" },
  { id: 3, label: "Review & send" },
];

export const projectTypes = [
  { value: "new-installation", label: "New installation", mobileLabel: "New install" },
  { value: "upgrade", label: "Upgrade / replacement", mobileLabel: "Upgrade" },
  { value: "multi-site", label: "Multi-site rollout", mobileLabel: "Multi-site" },
  // Desktop only in the 390 frame.
  { value: "government", label: "Government / e-catalog", desktopOnly: true },
] as const;
