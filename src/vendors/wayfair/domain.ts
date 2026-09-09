import type {
	WayfairAcceptDropshipOrderInput,
	WayfairSendShipmentNoticeInput,
	WayfairShipmentAddressInput
} from './contracts'

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
