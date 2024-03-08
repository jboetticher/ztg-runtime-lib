import { exec } from 'child_process';
import * as fs from 'fs';
import { config } from 'dotenv';

export function generateCustomSpec() {
  // The input and output file paths
  const PATH_TO_CUSTOM_SPEC: string = process.env.PATH_TO_CUSTOM_SPEC!;
  const PATH_TO_NODE: string = process.env.PATH_TO_NODE!;

  // Generate the spec
  const generateSpecCommand =
    PATH_TO_NODE +
    ' build-spec --chain=dev --disable-default-bootnode > ' +
    PATH_TO_CUSTOM_SPEC;

  exec(generateSpecCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error generating custom spec: ${error}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
    }

    // Inject desired data
    fs.readFile(PATH_TO_CUSTOM_SPEC, 'utf8', (err: any, jsonString: string) => {
      if (err) {
        console.error('Failed to read the base spec file:', err);
        return;
      }

      // Inject custom data into the spec
      const inject = injectDataIntoSpecAndStringify(jsonString);

      fs.writeFile(PATH_TO_CUSTOM_SPEC, inject, 'utf8', (err: any) => {
        if (err) {
          console.error('Failed to write the modified spec file:', err);
          return;
        }

        // Proceed to convert to raw format
        convertSpecToRaw();
      });
    });
  });
}

export function convertSpecToRaw() {
  const PATH_TO_CUSTOM_SPEC: string = process.env.PATH_TO_CUSTOM_SPEC!;
  const PATH_TO_CUSTOM_SPEC_RAW: string = process.env.PATH_TO_CUSTOM_RAW_SPEC!;
  const PATH_TO_NODE: string = process.env.PATH_TO_NODE!;

  const convertCommand = `${PATH_TO_NODE} build-spec --chain=${PATH_TO_CUSTOM_SPEC} --raw --disable-default-bootnode > ${PATH_TO_CUSTOM_SPEC_RAW}`;

  exec(convertCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error converting spec to raw: ${error}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
    }
  });
}

/*
NOTE: 
This is a work-around of a function. It expects "genesis" to be the final field within the spec.
It also expects for "system" to be the first field within the spec.
*/
function injectDataIntoSpecAndStringify(jsonString: string) {
  const specInjection = `
  "balances": {
    "balances": [
      [
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        21267647932558653966460912964485513215
      ],
      [
        "5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY",
        21267647932558653966460912964485513215
      ],
      [
        "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
        21267647932558653966460912964485513215
      ],
      [
        "5HpG9w8EBLe5XCrbczpwq5TSXvedjrBGCwqxK1iQ7qUsSWFc",
        21267647932558653966460912964485513215
      ],
      [
        "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y",
        21267647932558653966460912964485513215
      ],
      [
        "5Ck5SLSHYac6WFt5UZRSsdJjwmpSZq85fd5TRNAdZQVzEAPT",
        21267647932558653966460912964485513215
      ],
      [
        "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy",
        21267647932558653966460912964485513215
      ],
      [
        "5HKPmK9GYtE1PSLsS1qiYU9xQ9Si1NcEhdeCq9sw5bqu4ns8",
        21267647932558653966460912964485513215
      ],
      [
        "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
        21267647932558653966460912964485513215
      ],
      [
        "5FCfAonRZgTFrTd9HREEyeJjDpT397KMzizE6T3DvebLFE7n",
        21267647932558653966460912964485513215
      ],
      [
        "5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL",
        21267647932558653966460912964485513215
      ],
      [
        "5CRmqmsiNFExV6VbdmPJViVxrWmkaXXvBrSX8oqBT8R9vmWk",
        21267647932558653966460912964485513215
      ],
      [
        "5GpXuV3kd62JEVSKKXzy3FfA2Xp3wBiJCUiyJnrBHvWX9DzA",
        21267647932558653966460912964485513215
      ]
    ]
  },
  "transactionPayment": {
    "multiplier": "1000000000000000000"
  },
  "treasury": null,
  "vesting": {
    "vesting": []
  },
  "democracy": {
    "phantom": null
  },
  "advisoryCommittee": {
    "phantom": null,
    "members": []
  },
  "advisoryCommitteeMembership": {
    "members": [],
    "phantom": null
  },
  "council": {
    "phantom": null,
    "members": []
  },
  "councilMembership": {
    "members": [],
    "phantom": null
  },
  "technicalCommittee": {
    "phantom": null,
    "members": []
  },
  "technicalCommitteeMembership": {
    "members": [],
    "phantom": null
  },
  "tokens": {
    "balances": []
  },
  "liquidityMining": {
    "initialBalance": 0,
    "perBlockDistribution": 0
  },
  "aura": {
    "authorities": [
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
    ]
  },
  "grandpa": {
    "authorities": [
      [
        "5FA9nQDVg267DEd8m1ZypXLBnvN7SFxYwV7ndqSYGiN9TTpu",
        1
      ]
    ]
  },
  "sudo": {
    "key": "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y"
  }
  `;

  // Find the system field, which should be within genesis.runtime
  const regex = /"system":\s*{\s*"code":\s*"(0x[0-9a-fA-F]+)"\s*},/;
  const match = jsonString.match(regex);

  if (match) {
    // Use the index of the system field to slice the string up to the "system" object
    // This example includes the "system" object; adjust the slice if you need to exclude it
    const position = match.index;
    return jsonString.slice(0, position) + match[0] + specInjection + "}}}";
  } else {
    throw new Error("No match found for spec's 'system', or 'system' structure differs from expectation.");
  }
}

config();
generateCustomSpec();