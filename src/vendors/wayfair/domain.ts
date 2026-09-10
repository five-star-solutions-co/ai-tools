import type {
	WayfairListCatalogItemsInput,
	WayfairUpdateCatalogItemMediaInput,
	WayfairUpdateCatalogItemsInput,
	WayfairUpdateCatalogItemGroupsInput,
	WayfairCreateFulfillmentOrderInput,
	WayfairListFulfillmentOrdersInput,
	WayfairListInboundOrdersInput,
	WayfairAcceptDropshipOrderInput,
	WayfairListInventoryAdjustmentsInput,
	WayfairListInventorySummaryInput,
	WayfairRegisterShipmentInput,
	WayfairSaveInventoryInput,
	WayfairListLabelGenerationEventsInput,
	WayfairSendShipmentNoticeInput,
	WayfairShipmentAddressInput
} from './contracts'

export function createFulfillmentOrderVariables(input: WayfairCreateFulfillmentOrderInput, supplierId: number) {
	const address = input.shipping_address
	const billing = input.billing_address
	return {
		fulfillmentOrderInput: {
			supplierId,
			...(input.seller_fulfillment_order_id !== undefined && {
				sellerFulfillmentOrderId: input.seller_fulfillment_order_id
			}),
			...(billing && {
				billingAddress: {
					name: billing.name,
					address1: billing.address1,
					city: billing.city,
					postalCode: billing.postal_code,
					countryShortName: billing.country_short_name,
					...(billing.address2 !== undefined && { address2: billing.address2 }),
					...(billing.state_short_name !== undefined && { stateShortName: billing.state_short_name })
				}
			}),
			customer: { orderNumber: input.customer.order_number },
			retailer: { retailerId: input.retailer.retailer_id, orderNumber: input.retailer.order_number },
			items: input.items.map((item) => ({
				supplierPartNumber: item.supplier_part_number,
				quantity: item.quantity,
				...(item.supplier_product_name !== undefined && { supplierProductName: item.supplier_product_name }),
				...(item.fulfillment_warehouse_id !== undefined && { fulfillmentWarehouseId: item.fulfillment_warehouse_id })
			})),
			shippingAddress: {
				name: address.name,
				address1: address.address1,
				city: address.city,
				postalCode: address.postal_code,
				countryShortName: address.country_short_name,
				...(address.address2 !== undefined && { address2: address.address2 }),
				...(address.state_short_name !== undefined && { stateShortName: address.state_short_name }),
				...(address.phone_number !== undefined && { phoneNumber: address.phone_number }),
				...(address.company_name !== undefined && { companyName: address.company_name })
			},
			shippingDetails: {
				...(input.shipping_details.shipping_account_number !== undefined && {
					shippingAccountNumber: input.shipping_details.shipping_account_number
				}),
				...(input.shipping_details.carrier_scac !== undefined && { carrierScac: input.shipping_details.carrier_scac }),
				...(input.shipping_details.ship_speed_code !== undefined && {
					shipSpeedCode: input.shipping_details.ship_speed_code
				})
			},
			...(input.delivery_signature_required !== undefined && {
				deliverySignatureRequired: input.delivery_signature_required
			})
		}
	}
}

export function fulfillmentOrderListVariables(input: WayfairListFulfillmentOrdersInput, supplierId: number) {
	return {
		orderDetailsListInput: {
			supplierId,
			page: input.page ?? 1,
			pageSize: input.page_size ?? 10,
			sortOption: { sortBy: input.sort_by ?? 'ORDER_CREATION_DATE', sortOrder: input.sort_order ?? 'DESC' },
			...(input.locale !== undefined && { locale: input.locale }),
			...(input.status !== undefined && { status: input.status }),
			...((input.retailer_ids !== undefined || input.retailer_order_numbers !== undefined) && {
				retailer: {
					...(input.retailer_ids !== undefined && { retailerIds: input.retailer_ids }),
					...(input.retailer_order_numbers !== undefined && { orderNumbers: input.retailer_order_numbers })
				}
			}),
			...(input.order_creation_date_interval && { orderCreationDateInterval: input.order_creation_date_interval }),
			...(input.shipping_date_interval && { shippingDateInterval: input.shipping_date_interval }),
			...(input.expected_shipping_date_interval && {
				expectedShippingDateInterval: input.expected_shipping_date_interval
			})
		}
	}
}

export function inboundOrderVariables(input: WayfairListInboundOrdersInput, supplierId: number) {
	const filter = input.filters
	return {
		supplierId,
		status: input.status,
		paginate: { limit: input.limit ?? 10, offset: input.offset ?? 0 },
		sorts: { createdDate: input.sort_order ?? 'ASCENDING' },
		...(filter && {
			filters: {
				...(filter.inbound_order_id !== undefined && { inboundOrderId: filter.inbound_order_id }),
				...(filter.legacy_order_id !== undefined && { legacyOrderId: filter.legacy_order_id }),
				...(filter.supplier_purchase_order_id !== undefined && {
					supplierPurchaseOrderId: filter.supplier_purchase_order_id
				}),
				...(filter.estimated_cargo_ready_date && { estimatedCargoReadyDate: filter.estimated_cargo_ready_date }),
				...(filter.created_date && { createdDate: filter.created_date }),
				...(filter.services !== undefined && { services: filter.services }),
				...(filter.receiving_reference_id !== undefined && { receivingReferenceId: filter.receiving_reference_id }),
				...(filter.supplier_part_number !== undefined && { supplierPartNumber: filter.supplier_part_number }),
				...(filter.inbound_shipment_id !== undefined && { inboundShipmentId: filter.inbound_shipment_id }),
				...(filter.bill_of_lading !== undefined && { billOfLading: filter.bill_of_lading })
			}
		})
	}
}

export function acceptOrderVariables(input: WayfairAcceptDropshipOrderInput) {
	return {
		poNumber: input.po_number,
		shipSpeed: input.ship_speed,
		lineItems: input.line_items.map((item) => ({
			partNumber: item.part_number,
			quantity: item.quantity,
			unitPrice: item.unit_price,
			estimatedShipDate: item.estimated_ship_date
		}))
	}
}

export function saveInventoryVariables(input: WayfairSaveInventoryInput) {
	return {
		feedKind: input.feed_kind,
		dryRun: input.dry_run,
		inventory: input.inventory.map((item) => ({
			supplierId: item.supplier_id,
			supplierPartNumber: item.supplier_part_number,
			quantityOnHand: item.quantity_on_hand,
			...(item.quantity_backordered !== undefined && { quantityBackordered: item.quantity_backordered }),
			...(item.quantity_on_order !== undefined && { quantityOnOrder: item.quantity_on_order }),
			...(item.item_next_availability_date !== undefined && {
				itemNextAvailabilityDate: item.item_next_availability_date
			}),
			...(item.product_name_and_options !== undefined && { productNameAndOptions: item.product_name_and_options }),
			...(item.discontinued !== undefined && { discontinued: item.discontinued })
		}))
	}
}

export function registerShipmentVariables(input: WayfairRegisterShipmentInput) {
	return {
		registrationInput: {
			poNumber: input.po_number,
			...(input.warehouse_id !== undefined && { warehouseId: input.warehouse_id }),
			...(input.request_for_pickup_date !== undefined && { requestForPickupDate: input.request_for_pickup_date }),
			...(input.shipping_units && {
				shippingUnits: input.shipping_units.map((unit) => ({
					partNumber: unit.part_number,
					unitType: unit.unit_type,
					weight: unit.weight,
					dimensions: unit.dimensions,
					groupIdentifier: unit.group_identifier,
					sequenceIdentifier: unit.sequence_identifier,
					...(unit.freight_class !== undefined && { freightClass: unit.freight_class }),
					...(unit.pallet_info && { palletInfo: unit.pallet_info })
				}))
			}),
			...(input.package_units && {
				packageUnits: input.package_units.map((unit) => ({
					unitType: unit.unit_type,
					weight: unit.weight,
					dimensions: unit.dimensions,
					...(unit.freight_class !== undefined && { freightClass: unit.freight_class }),
					containedParts: unit.contained_parts.map((part) => ({
						partNumber: part.part_number,
						groupIdentifier: part.group_identifier
					}))
				}))
			})
		}
	}
}

export function labelEventVariables(input: WayfairListLabelGenerationEventsInput) {
	return {
		limit: input.limit ?? 10,
		offset: input.offset ?? 0,
		...(input.ordering && { ordering: input.ordering }),
		...(input.filters && {
			filters: input.filters.map((filter) => ({
				field: filter.field,
				...(filter.conjunction !== undefined && { conjunction: filter.conjunction }),
				...(filter.equals !== undefined && { equals: filter.equals }),
				...(filter.greater_than !== undefined && { greaterThan: filter.greater_than }),
				...(filter.greater_than_or_equal_to !== undefined && { greaterThanOrEqualTo: filter.greater_than_or_equal_to }),
				...(filter.less_than !== undefined && { lessThan: filter.less_than }),
				...(filter.less_than_or_equal_to !== undefined && { lessThanOrEqualTo: filter.less_than_or_equal_to }),
				...(filter.not_equal_to !== undefined && { notEqualTo: filter.not_equal_to }),
				...(filter.in !== undefined && { in: filter.in }),
				...(filter.not_in !== undefined && { notIn: filter.not_in }),
				...(filter.is_null !== undefined && { isNull: filter.is_null })
			}))
		})
	}
}

export function inventorySummaryVariables(input: WayfairListInventorySummaryInput) {
	return {
		...((input.supplier_part_numbers !== undefined || input.warehouse_id !== undefined) && {
			filter: {
				...(input.supplier_part_numbers && { supplierPartNumbers: input.supplier_part_numbers }),
				...(input.warehouse_id !== undefined && { warehouseId: input.warehouse_id })
			}
		}),
		page: {
			first: input.limit ?? 50,
			...(input.cursor !== undefined && { after: input.cursor })
		}
	}
}

export function inventoryAdjustmentVariables(input: WayfairListInventoryAdjustmentsInput) {
	const hasDateInterval = input.from_datetime !== undefined || input.to_datetime !== undefined
	return {
		...((input.supplier_part_number !== undefined || hasDateInterval) && {
			filter: {
				...(input.supplier_part_number !== undefined && { supplierPartNumber: input.supplier_part_number }),
				...(hasDateInterval && {
					transactionDateInterval: {
						...(input.from_datetime !== undefined && { from: input.from_datetime }),
						...(input.to_datetime !== undefined && { to: input.to_datetime })
					}
				})
			}
		}),
		page: { page: input.page ?? 0, pageSize: input.page_size ?? 50 },
		sortOption: { sortBy: input.sort_by ?? 'EVENT_DATE', sortOrder: input.sort_order ?? 'DESC' }
	}
}

function shipmentAddress(input: WayfairShipmentAddressInput) {
	return {
		name: input.name,
		streetAddress1: input.street_address1,
		...(input.street_address2 !== undefined && { streetAddress2: input.street_address2 }),
		city: input.city,
		...(input.state !== undefined && { state: input.state }),
		...(input.postal_code !== undefined && { postalCode: input.postal_code }),
		country: input.country
	}
}

export function shipmentNoticeVariables(input: WayfairSendShipmentNoticeInput) {
	return {
		notice: {
			poNumber: input.po_number,
			supplierId: input.supplier_id,
			packageCount: input.package_count,
			...(input.weight !== undefined && { weight: input.weight }),
			...(input.volume !== undefined && { volume: input.volume }),
			carrierCode: input.carrier_code,
			shipSpeed: input.ship_speed,
			trackingNumber: input.tracking_number,
			shipDate: input.ship_date,
			sourceAddress: shipmentAddress(input.source_address),
			destinationAddress: shipmentAddress(input.destination_address),
			...(input.small_parcel_shipments && {
				smallParcelShipments: input.small_parcel_shipments.map((shipment) => ({
					package: shipment.package,
					items: shipment.items.map((item) => ({
						partNumber: item.part_number,
						quantity: item.quantity
					}))
				}))
			}),
			...(input.large_parcel_shipments && {
				largeParcelShipments: input.large_parcel_shipments.map((shipment) => ({
					partNumber: shipment.part_number,
					packages: shipment.packages
				}))
			})
		}
	}
}

export function catalogItemsVariables(input: WayfairListCatalogItemsInput) {
	const filter = input.filter
	return {
		input: {
			paginationOptions: {
				page: input.pagination_options.page ?? 1,
				pageSize: input.pagination_options.page_size ?? 30
			},
			...(filter && {
				filter: {
					...(filter.supplier_part_numbers !== undefined && { supplierPartNumbers: filter.supplier_part_numbers }),
					...(filter.listing_ids !== undefined && { listingIds: filter.listing_ids }),
					...(filter.catalog_item_statuses !== undefined && { catalogItemStatuses: filter.catalog_item_statuses })
				}
			})
		},
		...(input.market_context && { marketContext: input.market_context })
	}
}

export function catalogItemMediaVariables(input: WayfairUpdateCatalogItemMediaInput, supplierId: number) {
	return {
		input: {
			supplierId: String(supplierId),
			validateOnly: input.validate_only,
			catalogItemsToUpdate: input.catalog_items_to_update.map((item) => ({
				supplierPartNumber: item.supplier_part_number,
				mediaType: item.media_type,
				...(item.media_url !== undefined && { mediaUrl: item.media_url }),
				...(item.action !== undefined && { action: item.action }),
				...(item.asset_id !== undefined && { assetId: item.asset_id }),
				...(item.legacy_asset_id !== undefined && { legacyAssetId: item.legacy_asset_id }),
				...(item.lead_image_override !== undefined && { leadImageOverride: item.lead_image_override })
			}))
		}
	}
}

export function catalogItemUpdateVariables(input: WayfairUpdateCatalogItemsInput, supplierId: number) {
	return {
		input: {
			supplierId: String(supplierId),
			marketContext: input.market_context,
			validateOnly: input.validate_only,
			catalogItemsToUpdate: input.catalog_items_to_update.map((item) => ({
				supplierPartNumber: item.supplier_part_number,
				...(item.item_name !== undefined && { itemName: item.item_name }),
				...(item.attributes && {
					attributes: {
						taxonomyCategoryId: item.attributes.taxonomy_category_id,
						updates: item.attributes.updates.map((attribute) => ({
							attributeId: attribute.attribute_id,
							value: attribute.value
						})),
						...(item.attributes.ignore_warnings !== undefined && { ignoreWarnings: item.attributes.ignore_warnings }),
						...(item.attributes.enable_autofill !== undefined && { enableAutofill: item.attributes.enable_autofill })
					}
				})
			}))
		}
	}
}

export function catalogItemGroupVariables(input: WayfairUpdateCatalogItemGroupsInput, supplierId: number) {
	return {
		input: {
			supplierId: String(supplierId),
			marketContext: input.market_context,
			validateOnly: input.validate_only,
			catalogItemGroupsToUpdate: input.catalog_item_groups_to_update.map((group) => ({
				itemGroupId: group.item_group_id,
				...(group.item_group_name !== undefined && { itemGroupName: group.item_group_name }),
				...(group.marketing_copy !== undefined && { marketingCopy: group.marketing_copy }),
				...(group.feature_bullets !== undefined && { featureBullets: group.feature_bullets }),
				...(group.option_content !== undefined && {
					optionContent: group.option_content.map((option) => ({
						optionId: option.option_id,
						optionName: option.option_name
					}))
				})
			}))
		}
	}
}
