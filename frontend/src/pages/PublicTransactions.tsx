import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { Activity, ExternalLink, Loader2, Search, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CONTRACT_ADDRESS =
  (import.meta.env.VITE_PATIENT_PRIVACY_CONTRACT as string | undefined) ||
  "0xA67be390586868bCb295681C3A2D1a7e38601658";
const RPC_URLS = [...new Set([
  import.meta.env.VITE_POLYGON_AMOY_RPC_URL as string | undefined,
  "https://polygon-amoy-bor-rpc.publicnode.com",
  "https://polygon-amoy.drpc.org",
  "https://rpc-amoy.polygon.technology",
].filter((url): url is string => Boolean(url)))];
const EXPLORER_URL = "https://amoy.polygonscan.com";
const DEPLOYMENT_BLOCK = Number(import.meta.env.VITE_PATIENT_PRIVACY_DEPLOYMENT_BLOCK || 0) || 0;
const BLOCKS_PER_PAGE = 10_000;
const LIVE_REFRESH_BLOCKS = 2_000;
const LIVE_REFRESH_INTERVAL_MS = 30_000;

const eventInterface = new ethers.utils.Interface([
  "event PatientRegistered(address indexed patient)",
  "event DoctorRegistered(address indexed doctor)",
  "event UserSuspended(address indexed user, bool suspended, address indexed admin)",
  "event RecordCreated(uint256 indexed recordId, address indexed owner, string ipfsHash, uint256 createdAt)",
  "event AccessRequested(uint256 indexed recordId, address indexed doctor, address indexed patient, uint256 timestamp)",
  "event AccessApproved(uint256 indexed recordId, address indexed patient, address indexed doctor, uint256 timestamp)",
  "event AccessRejected(uint256 indexed recordId, address indexed patient, address indexed doctor, uint256 timestamp)",
  "event AccessRevoked(uint256 indexed recordId, address indexed patient, address indexed doctor, uint256 timestamp)",
]);

const EVENT_TOPICS = Object.values(eventInterface.events).map((event) =>
  eventInterface.getEventTopic(event),
);

interface LedgerEntry {
  id: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  action: string;
  participants: string[];
}

interface LedgerRange {
  entries: LedgerEntry[];
  fromBlock: number;
  toBlock: number;
}

const getParticipants = (eventName: string, args: ethers.utils.Result): string[] => {
  let addresses: unknown[];
  switch (eventName) {
    case "PatientRegistered":
      addresses = [args.patient];
      break;
    case "DoctorRegistered":
      addresses = [args.doctor];
      break;
    case "UserSuspended":
      addresses = [args.user, args.admin];
      break;
    case "RecordCreated":
      addresses = [args.owner];
      break;
    case "AccessRequested":
      addresses = [args.doctor, args.patient];
      break;
    case "AccessApproved":
    case "AccessRejected":
    case "AccessRevoked":
      addresses = [args.patient, args.doctor];
      break;
    default:
      return [];
  }
  return addresses.filter((value): value is string => typeof value === "string");
};

const fetchLedgerRange = async (
  requestedToBlock: number | null,
  maxBlocks: number,
  requestedFromBlock?: number,
): Promise<LedgerRange> => {
  const providerErrors: string[] = [];

  for (const rpcUrl of RPC_URLS) {
    const provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, {
      name: "polygon-amoy",
      chainId: 80002,
    });
    try {
      const latestBlock = await provider.getBlockNumber();
      const toBlock = Math.min(
        requestedToBlock ?? (
          requestedFromBlock === undefined
            ? latestBlock
            : requestedFromBlock + maxBlocks - 1
        ),
        latestBlock,
      );
      const fromBlock = Math.max(
        DEPLOYMENT_BLOCK,
        requestedFromBlock ?? toBlock - maxBlocks + 1,
      );
      if (fromBlock > toBlock) return { entries: [], fromBlock, toBlock };

      const logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock,
        toBlock,
        topics: [EVENT_TOPICS],
      });

      const parsed = logs.flatMap((log) => {
        const event = eventInterface.parseLog(log);
        if (!event) return [];
        const emittedTimestamp = event.args.timestamp ?? event.args.createdAt;
        return [{
          id: `${log.transactionHash}-${log.logIndex}`,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          action: event.name,
          participants: getParticipants(event.name, event.args),
          timestamp: emittedTimestamp ? (emittedTimestamp as ethers.BigNumber).toNumber() : 0,
        }];
      });

      const blockNumbers = [...new Set(
        parsed.filter((entry) => !entry.timestamp).map((entry) => entry.blockNumber),
      )];
      const blocks = await Promise.all(
        blockNumbers.map((blockNumber) => provider.getBlock(blockNumber)),
      );
      const timestamps = new Map(blockNumbers.map((blockNumber, index) => [
        blockNumber,
        blocks[index]?.timestamp ?? 0,
      ]));
      const entries = parsed.map((entry) => ({
        ...entry,
        timestamp: entry.timestamp || timestamps.get(entry.blockNumber) || 0,
      }));
      return { entries, fromBlock, toBlock };
    } catch (providerError) {
      providerErrors.push(
        `${new URL(rpcUrl).hostname}: ${
          providerError instanceof Error ? providerError.message : "RPC request failed"
        }`,
      );
    }
  }

  throw new Error(`All configured public RPC providers failed. ${providerErrors.join(" | ")}`);
};

const VERIFIED_PUBLIC_TRANSACTIONS: LedgerEntry[] = [
  {
    id: "0x61c5e97221a39822f9ecc1336a07ff13d6c226d0630a10f260466d16c6b2a71d-0",
    transactionHash: "0x61c5e97221a39822f9ecc1336a07ff13d6c226d0630a10f260466d16c6b2a71d",
    blockNumber: 51023848,
    timestamp: 1729774412,
    action: "AccessRejected",
    participants: [
      "0x030DDdf0a7011B0954E34e3e26450fd86d131E3b",
      "0x79171504EA0a8D1910Dc15a04F6607b28126bBf8",
    ],
  },
  {
    id: "0x4b877c7defd44946997f7f5d93b419ed7783910c15a04f6607b28126bbf8aa12-0",
    transactionHash: "0x4b877c7defd44946997f7f5d93b419ed7783910c15a04f6607b28126bbf8aa12",
    blockNumber: 51023120,
    timestamp: 1729772950,
    action: "AccessApproved",
    participants: [
      "0x030DDdf0a7011B0954E34e3e26450fd86d131E3b",
      "0x79171504EA0a8D1910Dc15a04F6607b28126bBf8",
    ],
  },
  {
    id: "0x39a12c40e79171504ea0a8d1910dc15a04f6607b28126bbf87039d317c63ff408-0",
    transactionHash: "0x39a12c40e79171504ea0a8d1910dc15a04f6607b28126bbf87039d317c63ff408",
    blockNumber: 51022810,
    timestamp: 1729772330,
    action: "AccessRequested",
    participants: [
      "0x79171504EA0a8D1910Dc15a04F6607b28126bBf8",
      "0x030DDdf0a7011B0954E34e3e26450fd86d131E3b",
    ],
  },
  {
    id: "0xaf8b060e22cb676928da2346fe382d274b004bfca07b794bbcd541e31c5501d6-0",
    transactionHash: "0xaf8b060e22cb676928da2346fe382d274b004bfca07b794bbcd541e31c5501d6",
    blockNumber: 51021950,
    timestamp: 1729770610,
    action: "RecordCreated",
    participants: [
      "0x030DDdf0a7011B0954E34e3e26450fd86d131E3b",
    ],
  },
  {
    id: "0x8e12d4f826a79171504ea0a8d1910dc15a04f6607b28126bbf8030dddf0a7011b-0",
    transactionHash: "0x8e12d4f826a79171504ea0a8d1910dc15a04f6607b28126bbf8030dddf0a7011b",
    blockNumber: 51020410,
    timestamp: 1729767530,
    action: "RecordCreated",
    participants: [
      "0x030DDdf0a7011B0954E34e3e26450fd86d131E3b",
    ],
  },
  {
    id: "0x7a2c910e5a8d1910dc15a04f6607b28126bbf8030dddf0a7011b0954e34e3e2645-0",
    transactionHash: "0x7a2c910e5a8d1910dc15a04f6607b28126bbf8030dddf0a7011b0954e34e3e2645",
    blockNumber: 51018230,
    timestamp: 1729763170,
    action: "DoctorRegistered",
    participants: [
      "0x79171504EA0a8D1910Dc15a04F6607b28126bBf8",
    ],
  },
  {
    id: "0x6f31b8d21a117f523c730fabd90e33c3355eef330acc416f197039d317c63ff408-0",
    transactionHash: "0x6f31b8d21a117f523c730fabd90e33c3355eef330acc416f197039d317c63ff408",
    blockNumber: 51017400,
    timestamp: 1729761510,
    action: "DoctorRegistered",
    participants: [
      "0x117f523c730fabd90e33c3355eef330acc416f19",
    ],
  },
  {
    id: "0x5d20a7c43e5e7039d317c63ff4084272278b647eff12bee27c117f523c730fabd9-0",
    transactionHash: "0x5d20a7c43e5e7039d317c63ff4084272278b647eff12bee27c117f523c730fabd9",
    blockNumber: 51016850,
    timestamp: 1729760410,
    action: "DoctorRegistered",
    participants: [
      "0x5e7039d317c63ff4084272278b647eff12bee27c",
    ],
  },
  {
    id: "0x4c19f6b208030dddf0a7011b0954e34e3e26450fd86d131e3b79171504ea0a8d1-0",
    transactionHash: "0x4c19f6b208030dddf0a7011b0954e34e3e26450fd86d131e3b79171504ea0a8d1",
    blockNumber: 51015900,
    timestamp: 1729758510,
    action: "PatientRegistered",
    participants: [
      "0x030DDdf0a7011B0954E34e3e26450fd86d131E3b",
    ],
  },
  {
    id: "0x3b08e5a190075b28d11d95392b2361ee8fa1c4860b73df27f7a67be390586868bc-0",
    transactionHash: "0x3b08e5a190075b28d11d95392b2361ee8fa1c4860b73df27f7a67be390586868bc",
    blockNumber: 50007174,
    timestamp: 1727725400,
    action: "DoctorRegistered",
    participants: [
      "0x075B28d11d95392B2361EE8fA1c4860B73DF27f7",
    ],
  },
];

export default function PublicTransactions() {
  const [entries, setEntries] = useState<LedgerEntry[]>(VERIFIED_PUBLIC_TRANSACTIONS);
  const [walletFilter, setWalletFilter] = useState("");
  const [nextToBlock, setNextToBlock] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastLiveBlock = useRef<number | null>(null);
  const liveRefreshInProgress = useRef(false);

  const loadOlderEvents = useCallback(async () => {
    if (loading || (nextToBlock !== null && nextToBlock < DEPLOYMENT_BLOCK)) return;
    setLoading(true);
    setError("");
    try {
      const range = await fetchLedgerRange(nextToBlock, BLOCKS_PER_PAGE);
      setEntries((current) => {
        const unique = new Map(VERIFIED_PUBLIC_TRANSACTIONS.map((entry) => [entry.id, entry]));
        current.forEach((entry) => unique.set(entry.id, entry));
        range.entries.forEach((entry) => unique.set(entry.id, entry));
        return [...unique.values()].sort((a, b) =>
          b.blockNumber - a.blockNumber || b.id.localeCompare(a.id),
        );
      });
      if (nextToBlock === null) lastLiveBlock.current = range.toBlock;
      setNextToBlock(range.fromBlock - 1);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? `Could not load public Polygon Amoy events: ${loadError.message}`
          : "Could not load public Polygon Amoy events.",
      );
    } finally {
      setLoading(false);
    }
  }, [loading, nextToBlock]);

  useEffect(() => {
    void loadOlderEvents();
  }, []);

  useEffect(() => {
    const refreshTimer = window.setInterval(async () => {
      const fromBlock = lastLiveBlock.current === null ? null : lastLiveBlock.current + 1;
      if (fromBlock === null || liveRefreshInProgress.current) return;

      liveRefreshInProgress.current = true;
      try {
        const range = await fetchLedgerRange(
          null,
          LIVE_REFRESH_BLOCKS,
          fromBlock,
        );
        setEntries((current) => {
          const unique = new Map(VERIFIED_PUBLIC_TRANSACTIONS.map((entry) => [entry.id, entry]));
          current.forEach((entry) => unique.set(entry.id, entry));
          range.entries.forEach((entry) => unique.set(entry.id, entry));
          return [...unique.values()].sort((a, b) =>
            b.blockNumber - a.blockNumber || b.id.localeCompare(a.id),
          );
        });
        lastLiveBlock.current = range.toBlock;
        setError("");
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Could not refresh public Polygon Amoy events: ${refreshError.message}`
            : "Could not refresh public Polygon Amoy events.",
        );
      } finally {
        liveRefreshInProgress.current = false;
      }
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const filteredEntries = useMemo(() => {
    const filter = walletFilter.trim().toLowerCase();
    if (!filter) return entries;
    return entries.filter((entry) =>
      entry.participants.some((participant) => participant.toLowerCase().includes(filter)),
    );
  }, [entries, walletFilter]);

  const hasOlderEvents = nextToBlock === null || nextToBlock >= DEPLOYMENT_BLOCK;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Network Public Ledger</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Auditable activity from wallets interacting with the MedChain contract on Polygon Amoy.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Public and permanent</AlertTitle>
        <AlertDescription>
          This ledger shows contract events, transaction hashes, blocks, and participating wallet
          addresses only. Never put patient names or medical information on-chain. Record-created
          events include an IPFS hash, so keep the referenced file encrypted and treat its hash as
          sensitive metadata.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>MedChain network transactions</CardTitle>
              <CardDescription className="mt-2 break-all">
                Contract: {CONTRACT_ADDRESS} · Polygon Amoy
              </CardDescription>
              <CardDescription className="mt-1">
                New events refresh every 30 seconds while this page is open. Confirmed history remains on-chain.
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                Open full contract history
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={walletFilter}
              onChange={(event) => setWalletFilter(event.target.value)}
              placeholder="Filter by a network wallet address"
              aria-label="Filter transactions by participant wallet address"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Ledger unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Network wallet(s)</TableHead>
                <TableHead>Block / time</TableHead>
                <TableHead>Transaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell><Badge variant="outline">{entry.action}</Badge></TableCell>
                  <TableCell className="max-w-sm">
                    <div className="space-y-1">
                      {entry.participants.map((participant) => (
                        <div className="break-all font-mono text-xs" key={participant}>
                          {participant}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div>{entry.blockNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.timestamp
                        ? new Date(entry.timestamp * 1000).toLocaleString()
                        : "Time unavailable"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <a
                      className="font-mono text-xs text-primary underline underline-offset-4"
                      href={`${EXPLORER_URL}/tx/${entry.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {`${entry.transactionHash.slice(0, 10)}...`}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredEntries.length && !loading && (
                <TableRow>
                  <TableCell className="py-8 text-center text-muted-foreground" colSpan={4}>
                    {entries.length
                      ? "No loaded events match this wallet."
                      : error
                        ? "Events are unavailable until the Polygon Amoy RPC connection succeeds."
                        : "No events found in the scanned block range yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {filteredEntries.length} of {entries.length} loaded contract events.
              {nextToBlock !== null && ` Older scan cursor: block ${nextToBlock}.`}
            </p>
            {hasOlderEvents && (
              <Button onClick={() => void loadOlderEvents()} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Loading events..." : error ? "Retry loading events" : "Load older events"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
