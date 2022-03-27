erpnext.utils.BarcodeScanner = class BarcodeScanner {
	constructor(opts) {
		$.extend(this, opts);

		// field from which to capture input of scanned data
		this.scan_field_name = opts.scan_field_name || "scan_barcode";
		this.scan_barcode_field = this.frm.fields_dict[this.scan_field_name];

		this.items_table_name = opts.items_table_name || "items";
		this.items_table = this.frm.doc[this.items_table_name];

		// any API that takes `search_value` as input and returns dictionary as follows
		// {
		//     item_code: "HORSESHOE", // present if any item was found
		//     bar_code: "123456", // present if barcode was scanned
		//     batch_no: "LOT12", // present if batch was scanned
		//     serial_no: "987XYZ", // present if serial no was scanned
		// }
		this.scan_api = opts.scan_api || "erpnext.selling.page.point_of_sale.point_of_sale.search_for_serial_or_batch_or_barcode_number";
	}

	process_scan() {
		let me = this;

		const input = this.scan_barcode_field.value;
		if (!input) {
			return;
		}

		frappe.call({
			method: this.scan_api,
			args: {
				search_value: input,
			}
		}).then(r => {
			const data = r && r.message;
			if (!data || Object.keys(data).length === 0) {
				frappe.show_alert({
					message: __('Cannot find Item with this Barcode'),
					indicator: 'red'
				});
				return;
			}

			me.update_table(data.item_code, data.barcode, data.batch_no, data.serial_no);
		});
	}

	update_table(item_code, barcode, batch_no, serial_no) {
		let cur_grid = this.frm.fields_dict[this.items_table_name].grid;
		let row = null;

		// Check if batch is scanned and table has batch no field
		let batch_no_scan = Boolean(batch_no) && frappe.meta.has_field(cur_grid.doctype, "batch_no");

		if (batch_no_scan) {
			row = this.get_batch_row_to_modify(batch_no);
		} else {
			// serial or barcode scan
			row = this.get_row_to_modify_on_scan(row, item_code);
		}

		if (!row) {
			// add new row if new item/batch is scanned
			row = frappe.model.add_child(this.frm.doc, cur_grid.doctype, this.items_table_name);
			// trigger any row add triggers defined on child table.
			this.frm.script_manager.trigger(`${this.items_table_name}_add`, row.doctype, row.name);
		}

		if (this.is_duplicate_serial_no(row, serial_no)) {
			this.clean_up();
			return;
		};

		this.show_scan_message(row.idx, row.item_code);
		this.set_item(row, item_code);
		this.set_serial_no(row, serial_no);
		this.set_batch_no(row, batch_no);
		this.set_barcode(row, barcode);
		this.clean_up();
	}

	set_item(row, item_code) {
		frappe.model.set_value(row.doctype, row.name, {
			item_code: item_code,
			qty: (row.qty || 0) + 1, // TODO: harcoded fieldname
		});
	}

	set_serial_no(row, serial_no) {
		if (serial_no && frappe.meta.has_field(row.doctype, "serial_no")) {
			// TODO: fieldname hardcoded
			const value = row["serial_no"] + '\n' + serial_no;
			frappe.model.set_value(row.doctype, row.name, "serial_no", value);
		}
	}

	set_batch_no(row, batch_no) {
		if (batch_no && frappe.meta.has_field(row.doctype, "batch_no")) {
			// TODO: fieldname hardcoded
			frappe.model.set_value(row.doctype, row.name, "batch_no", batch_no);
		}
	}

	set_barcode(row, barcode) {
		// increase qty and set scanned value and item in row
		// XXX: tightly coupled global flag on frm object used in transaction.js -_-
		this.frm.from_barcode = this.frm.from_barcode ? this.frm.from_barcode + 1 : 1;
		if (barcode && frappe.meta.has_field(row.doctype, "barcode")) {
			// TODO: fieldname hardcoded
			frappe.model.set_value(row.doctype, row.name, "barcode", barcode);
		}
	}

	show_scan_message (idx, exist = null) {
		// show new row or qty increase toast
		if (exist) {
			frappe.show_alert({
				message: __('Row #{0}: Qty increased by 1', [idx]),
				indicator: 'green'
			}, 5);
		} else {
			frappe.show_alert({
				message: __('Row #{0}: Item added', [idx]),
				indicator: 'green'
			}, 5);
		}
	}

	is_duplicate_serial_no(row, serial_no) {
		const is_duplicate = !!serial_no && !!row.serial_no && row.serial_no.includes(serial_no);

		if (is_duplicate) {
			frappe.show_alert({
				message: __('Serial No {0} is already added', [serial_no]),
				indicator: 'orange'
			}, 5);
		}
		return is_duplicate;
	}


	get_batch_row_to_modify(batch_no) {
		// get row if batch already exists in table
		const existing_batch_row = this.items_table.find(d => d.batch_no === batch_no);
		return existing_batch_row || null;
	}

	get_row_to_modify_on_scan(row_to_modify, item_code) {
		// get an existing item row to increment or blank row to modify
		const existing_item_row = this.items_table.find(d => d.item_code === item_code);
		const blank_item_row = this.items_table.find(d => !d.item_code);

		if (existing_item_row) {
			row_to_modify = existing_item_row;
		} else if (blank_item_row) {
			row_to_modify = blank_item_row;
		}

		return row_to_modify;
	}

	clean_up() {
		this.scan_barcode_field.set_value("");
		refresh_field(this.items_table_name);
	}
};