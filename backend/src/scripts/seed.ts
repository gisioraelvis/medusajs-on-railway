import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

async function cleanupExistingData(container: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productModuleService = container.resolve(Modules.PRODUCT);
  const regionModuleService = container.resolve(Modules.REGION);
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);
  const apiKeyModuleService = container.resolve(Modules.API_KEY);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("Starting database cleanup...");

  try {
    // Delete inventory levels and items
    logger.info("Cleaning inventory levels...");
    try {
      const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id"],
      });

      if (inventoryItems.length > 0) {
        const inventoryModuleService = container.resolve(Modules.INVENTORY);
        for (const item of inventoryItems) {
          try {
            const levels = await inventoryModuleService.listInventoryLevels({
              inventory_item_id: item.id,
            });
            for (const level of levels) {
              await inventoryModuleService.deleteInventoryLevels([level.id]);
            }
            await inventoryModuleService.deleteInventoryItems([item.id]);
          } catch (error: any) {
            logger.warn(
              `Failed to delete inventory item ${item.id}: ${
                error.message || error
              }`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean inventory: ${error.message || error}`);
    }

    // Delete products
    logger.info("Cleaning products...");
    try {
      const products = await productModuleService.listProducts({});
      if (products.length > 0) {
        for (const product of products) {
          try {
            await productModuleService.deleteProducts([product.id]);
          } catch (err: any) {
            logger.warn(
              `Failed to delete product ${product.id}: ${err.message || err}`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean products: ${error.message || error}`);
    }

    // Delete product categories
    logger.info("Cleaning product categories...");
    try {
      const categories = await productModuleService.listProductCategories({});
      if (categories.length > 0) {
        for (const category of categories) {
          try {
            await productModuleService.deleteProductCategories([category.id]);
          } catch (err: any) {
            logger.warn(
              `Failed to delete category ${category.id}: ${err.message || err}`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean categories: ${error.message || error}`);
    }

    // Delete shipping options and fulfillment sets
    logger.info("Cleaning shipping options and fulfillment sets...");
    try {
      const shippingOptions =
        await fulfillmentModuleService.listShippingOptions({});
      for (const option of shippingOptions) {
        try {
          await fulfillmentModuleService.deleteShippingOptions([option.id]);
        } catch (err: any) {
          logger.warn(
            `Failed to delete shipping option ${option.id}: ${
              err.message || err
            }`
          );
        }
      }

      const fulfillmentSets =
        await fulfillmentModuleService.listFulfillmentSets({});
      for (const set of fulfillmentSets) {
        try {
          await fulfillmentModuleService.deleteFulfillmentSets([set.id]);
        } catch (err: any) {
          logger.warn(
            `Failed to delete fulfillment set ${set.id}: ${err.message || err}`
          );
        }
      }
    } catch (error: any) {
      logger.warn(
        `Failed to clean fulfillment data: ${error.message || error}`
      );
    }

    // Delete custom stock locations (keep default ones)
    logger.info("Cleaning stock locations...");
    try {
      const stockLocations =
        await stockLocationModuleService.listStockLocations({});
      const customStockLocations = stockLocations.filter(
        (loc: any) => !loc.name.toLowerCase().includes("default")
      );
      if (customStockLocations.length > 0) {
        for (const location of customStockLocations) {
          try {
            await stockLocationModuleService.deleteStockLocations([
              location.id,
            ]);
          } catch (err: any) {
            logger.warn(
              `Failed to delete stock location ${location.id}: ${
                err.message || err
              }`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean stock locations: ${error.message || error}`);
    }

    // Delete custom API keys (keep system ones)
    logger.info("Cleaning API keys...");
    try {
      const apiKeys = await apiKeyModuleService.listApiKeys({});
      const customApiKeys = apiKeys.filter(
        (key: any) =>
          key.title !== "System" && !key.title.toLowerCase().includes("system")
      );
      if (customApiKeys.length > 0) {
        for (const apiKey of customApiKeys) {
          try {
            // Revoke the API key before deleting, if not already revoked
            if (!apiKey.revoked_at) {
              await apiKeyModuleService.revoke(apiKey.id, {
                revoked_by: "seed-script",
              });
            }
            await apiKeyModuleService.deleteApiKeys([apiKey.id]);
          } catch (err: any) {
            logger.warn(
              `Failed to revoke/delete API key ${apiKey.id}: ${
                err.message || err
              }`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean API keys: ${error.message || error}`);
    }

    // Delete regions
    logger.info("Cleaning regions...");
    try {
      const regions = await regionModuleService.listRegions({});
      if (regions.length > 0) {
        for (const region of regions) {
          try {
            await regionModuleService.deleteRegions([region.id]);
          } catch (err: any) {
            logger.warn(
              `Failed to delete region ${region.id}: ${err.message || err}`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean regions: ${error.message || error}`);
    }

    // Delete tax regions
    logger.info("Cleaning tax regions...");
    try {
      const taxModuleService = container.resolve(Modules.TAX);
      const taxRegions = await taxModuleService.listTaxRegions({});
      if (taxRegions.length > 0) {
        for (const taxRegion of taxRegions) {
          try {
            await taxModuleService.deleteTaxRegions([taxRegion.id]);
          } catch (err: any) {
            logger.warn(
              `Failed to delete tax region ${taxRegion.id}: ${
                err.message || err
              }`
            );
          }
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean tax regions: ${error.message || error}`);
    }

    // Delete custom sales channels (keep default)
    logger.info("Cleaning custom sales channels...");
    try {
      const salesChannels = await salesChannelModuleService.listSalesChannels(
        {}
      );
      const customSalesChannels = salesChannels.filter(
        (sc: any) => sc.name !== "Default Sales Channel"
      );
      for (const channel of customSalesChannels) {
        try {
          await salesChannelModuleService.deleteSalesChannels([channel.id]);
        } catch (err: any) {
          logger.warn(
            `Failed to delete sales channel ${channel.id}: ${
              err.message || err
            }`
          );
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to clean sales channels: ${error.message || error}`);
    }

    logger.info("Database cleanup completed successfully.");
  } catch (error: any) {
    logger.error("Error during database cleanup:", error);
    // Continue with seeding even if cleanup fails
  }
}

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  // Clean existing data first to avoid conflicts
  await cleanupExistingData(container);

  // East African countries
  const eastAfricanCountries = ["ke", "tz", "ug", "rw", "et", "ss"];

  // North American countries
  const northAmericanCountries = ["us", "ca"];

  // European countries
  const europeanCountries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  const allCountries = [
    ...eastAfricanCountries,
    ...northAmericanCountries,
    ...europeanCountries,
  ];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "kes",
            is_default: true,
          },
          {
            currency_code: "usd",
          },
          {
            currency_code: "eur",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "East Africa",
          currency_code: "kes",
          countries: eastAfricanCountries,
          payment_providers: ["pp_system_default"],
        },
        {
          name: "North America",
          currency_code: "usd",
          countries: northAmericanCountries,
          payment_providers: ["pp_system_default"],
        },
        {
          name: "Europe",
          currency_code: "eur",
          countries: europeanCountries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const eastAfricaRegion = regionResult[0];
  const northAmericaRegion = regionResult[1];
  const europeRegion = regionResult[2];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: allCountries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "East Africa Warehouse",
          address: {
            city: "Nairobi",
            country_code: "KE",
            address_1: "",
          },
        },
        {
          name: "US Warehouse",
          address: {
            city: "New York",
            country_code: "US",
            address_1: "",
          },
        },
        {
          name: "European Warehouse",
          address: {
            city: "Copenhagen",
            country_code: "DK",
            address_1: "",
          },
        },
      ],
    },
  });
  const eastAfricaStockLocation = stockLocationResult[0];
  const usStockLocation = stockLocationResult[1];
  const europeanStockLocation = stockLocationResult[2];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: eastAfricaStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: usStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: europeanStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const eastAfricaFulfillmentSet =
    await fulfillmentModuleService.createFulfillmentSets({
      name: "East Africa Warehouse delivery",
      type: "shipping",
      service_zones: [
        {
          name: "East Africa",
          geo_zones: eastAfricanCountries.map((country_code) => ({
            country_code,
            type: "country" as const,
          })),
        },
      ],
    });

  const usFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets(
    {
      name: "US Warehouse delivery",
      type: "shipping",
      service_zones: [
        {
          name: "North America",
          geo_zones: northAmericanCountries.map((country_code) => ({
            country_code,
            type: "country" as const,
          })),
        },
      ],
    }
  );

  const europeanFulfillmentSet =
    await fulfillmentModuleService.createFulfillmentSets({
      name: "European Warehouse delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Europe",
          geo_zones: europeanCountries.map((country_code) => ({
            country_code,
            type: "country" as const,
          })),
        },
      ],
    });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: eastAfricaStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: eastAfricaFulfillmentSet.id,
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: usStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: usFulfillmentSet.id,
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: europeanStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: europeanFulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      // East African shipping options
      {
        name: "Standard Shipping - East Africa",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: eastAfricaFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 3-5 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "kes",
            amount: 800,
          },
          {
            currency_code: "usd",
            amount: 8,
          },
          {
            currency_code: "eur",
            amount: 8,
          },
          {
            region_id: eastAfricaRegion.id,
            amount: 800,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping - East Africa",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: eastAfricaFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 1-2 days.",
          code: "express",
        },
        prices: [
          {
            currency_code: "kes",
            amount: 1500,
          },
          {
            currency_code: "usd",
            amount: 15,
          },
          {
            currency_code: "eur",
            amount: 15,
          },
          {
            region_id: eastAfricaRegion.id,
            amount: 1500,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      // US shipping options
      {
        name: "Standard Shipping - USA",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: usFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 12,
          },
          {
            currency_code: "kes",
            amount: 1560,
          },
          {
            currency_code: "eur",
            amount: 12,
          },
          {
            region_id: northAmericaRegion.id,
            amount: 12,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping - USA",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: usFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 1-2 days.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 25,
          },
          {
            currency_code: "kes",
            amount: 3250,
          },
          {
            currency_code: "eur",
            amount: 25,
          },
          {
            region_id: northAmericaRegion.id,
            amount: 25,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      // European shipping options
      {
        name: "Standard Shipping - Europe",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: europeanFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            currency_code: "kes",
            amount: 1300, // ~10 EUR in KES
          },
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            region_id: europeRegion.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping - Europe",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: europeanFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "eur",
            amount: 20,
          },
          {
            currency_code: "kes",
            amount: 2600, // ~20 EUR in KES
          },
          {
            currency_code: "usd",
            amount: 20,
          },
          {
            region_id: europeRegion.id,
            amount: 20,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: eastAfricaStockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: usStockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: europeanStockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Shirts",
          is_active: true,
        },
        {
          name: "Sweatshirts",
          is_active: true,
        },
        {
          name: "Pants",
          is_active: true,
        },
        {
          name: "Merch",
          is_active: true,
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Medusa T-Shirt",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Shirts")!.id,
          ],
          description:
            "Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.",
          handle: "t-shirt",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-back.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "S / Black",
              sku: "SHIRT-S-BLACK",
              options: {
                Size: "S",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
                {
                  amount: 1200,
                  currency_code: "kes",
                },
              ],
            },
            {
              title: "S / White",
              sku: "SHIRT-S-WHITE",
              options: {
                Size: "S",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
                {
                  amount: 1200,
                  currency_code: "kes",
                },
              ],
            },
            {
              title: "M / Black",
              sku: "SHIRT-M-BLACK",
              options: {
                Size: "M",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M / White",
              sku: "SHIRT-M-WHITE",
              options: {
                Size: "M",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L / Black",
              sku: "SHIRT-L-BLACK",
              options: {
                Size: "L",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L / White",
              sku: "SHIRT-L-WHITE",
              options: {
                Size: "L",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL / Black",
              sku: "SHIRT-XL-BLACK",
              options: {
                Size: "XL",
                Color: "Black",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL / White",
              sku: "SHIRT-XL-WHITE",
              options: {
                Size: "XL",
                Color: "White",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Medusa Sweatshirt",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Sweatshirts")!.id,
          ],
          description:
            "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
          handle: "sweatshirt",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "SWEATSHIRT-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "SWEATSHIRT-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "SWEATSHIRT-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "SWEATSHIRT-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Medusa Sweatpants",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Pants")!.id,
          ],
          description:
            "Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.",
          handle: "sweatpants",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "SWEATPANTS-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "SWEATPANTS-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "SWEATPANTS-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "SWEATPANTS-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        {
          title: "Medusa Shorts",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Merch")!.id,
          ],
          description:
            "Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.",
          handle: "shorts",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-back.png",
            },
          ],
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "SHORTS-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "SHORTS-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "SHORTS-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "SHORTS-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "eur",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    // Add inventory for East Africa warehouse
    const eastAfricaInventoryLevel = {
      location_id: eastAfricaStockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(eastAfricaInventoryLevel);

    // Add inventory for US warehouse
    const usInventoryLevel = {
      location_id: usStockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(usInventoryLevel);

    // Add inventory for European warehouse
    const europeanInventoryLevel = {
      location_id: europeanStockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(europeanInventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
