import React from 'react';
import AuctionWorkspace from '../../../components/AuctionWorkspace/AuctionWorkspace';

export default function AuctionControl() {
  return (
    <AuctionWorkspace
      mode="admin"
      title="Auction Control"
      subtitle="Create and supervise product auction listings across sellers from one control surface."
    />
  );
}
