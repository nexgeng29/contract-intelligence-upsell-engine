// metadata-extractor.mjs
import path from "node:path";

export class MetadataExtractor {
  extractFromS3Key(key) {
    console.log("Extracting metadata from S3 key", { key });

    // Expected S3 key: customers/CUST001/contract.pdf or CUST001/contract.pdf
    const normalized = key.replace(/^\/+/, "");
    const parts = normalized.split("/");

    let customerId;
    let fileName;
    let contractId;

    if (parts[0] === "customers" && parts.length >= 3) {
      customerId = parts[1];
      fileName = parts.slice(2).join("/");
    } else if (parts.length >= 2) {
      customerId = parts[0];
      fileName = parts.slice(1).join("/");
    } else {
      throw new Error(
        `Invalid S3 key format: ${key}. Expected: customers/CUST_ID/filename or CUST_ID/filename`,
      );
    }

    if (!customerId) {
      throw new Error(`Could not extract customer ID from S3 key: ${key}`);
    }

    const baseName = path.posix.basename(fileName);
    const extension = path.posix.extname(baseName);
    const nameWithoutExt = path.posix.basename(baseName, extension);
    contractId = nameWithoutExt.split("_")[0];

    console.log("Metadata extracted", { customerId, contractId, fileName });

    return { customerId, contractId, fileName };
  }
}
