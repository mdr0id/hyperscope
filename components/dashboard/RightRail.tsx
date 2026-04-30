"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSelection } from "@/app/dashboard-shell";
import { EventFeed } from "@/components/feed/EventFeed";
import { ValidatorPreview } from "@/components/validator-detail/ValidatorPreview";

export function RightRail() {
  const { selected } = useSelection();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selected ? (
        <motion.div
          key={`preview-${selected}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          <ValidatorPreview address={selected} />
        </motion.div>
      ) : (
        <motion.div
          key="feed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          <EventFeed />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
