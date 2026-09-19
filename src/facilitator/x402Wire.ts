import { z } from "zod";

/**
 * x402 Protocol Wire Format (https://github.com/coinbase/x402)
 * Standardized HTTP 402 "Payment Required" challenge and response codec for AI agent services.
 *
 * In Circuits Protocol, agents meter access to inference endpoints, data feeds, and subgraphs
 * by returning a 402 challenge specifying required payment. The payer authorizes payment
 * which the X402Facilitator contract settles on Arc Mainnet, returning cryptographic proof
 * in the X-PAYMENT request header.
 */

export const X402_VERSION = 1;

export const PaymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  maxAmountRequired: z.string(),
  resource: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().optional(),
  asset: z.string(),
  extra: z.object({ settlement: z.string().optional() }).passthrough().optional(),
});

export const X402ResponseBodySchema = z.object({
  x402Version: z.number(),
  error: z.string().optional(),
  accepts: z.array(PaymentRequirementsSchema),
});

export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;
export type X402ResponseBody = z.infer<typeof X402ResponseBodySchema>;

export interface FacilitatorPullPayload {
  chain: string;
  payer: string;
  recipient: string;
  amount: string;
  idempotencyKey: string;
  txHashOrRef: string;
}

export interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: FacilitatorPullPayload;
}

/**
 * Parses an inbound 402 response body into its payment requirements.
 */
export function parseX402Body(body: unknown): PaymentRequirements[] | null {
  const parsed = X402ResponseBodySchema.safeParse(body);
  if (!parsed.success || parsed.data.accepts.length === 0) return null;
  return parsed.data.accepts;
}

/**
 * Builds the base64-encoded X-PAYMENT header for the client retry request.
 */
export function encodePaymentHeader(
  requirements: PaymentRequirements,
  pull: FacilitatorPullPayload,
): string {
  const payload: X402PaymentPayload = {
    x402Version: X402_VERSION,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: pull,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Decodes and validates an inbound X-PAYMENT header on the service provider side.
 */
export function decodePaymentHeader(header: string): X402PaymentPayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    if (
      typeof decoded?.x402Version !== "number" ||
      typeof decoded?.scheme !== "string" ||
      typeof decoded?.network !== "string" ||
      typeof decoded?.payload !== "object"
    ) {
      return null;
    }
    return decoded as X402PaymentPayload;
  } catch {
    return null;
  }
}

/**
 * Constructs a canonical 402 Payment Required response payload for an agent API endpoint.
 */
export function build402ChallengeResponse(params: {
  resource: string;
  payTo: string;
  amountUsdc: string;
  description?: string;
  network?: string;
  assetAddress?: string;
}): X402ResponseBody {
  const {
    resource,
    payTo,
    amountUsdc,
    description = "Metered AI Agent Query",
    network = "eip155:5042", // Arc Mainnet CAIP-2 identifier
    assetAddress = "0x3600000000000000000000000000000000000000",
  } = params;

  return {
    x402Version: X402_VERSION,
    error: "Payment required to access agent resource",
    accepts: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: amountUsdc,
        resource,
        description,
        mimeType: "application/json",
        payTo,
        maxTimeoutSeconds: 60,
        asset: assetAddress,
        extra: {
          settlement: "circuits-protocol-facilitator-pull",
        },
      },
    ],
  };
}
