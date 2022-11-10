const show_esito = (esiti) => { 
	if (esiti.length == 0)
		frappe.show_alert({
			message:__('Waiting response from SDI'),
			indicator:'orange'
			}, 5);
	else {
	let d = new frappe.ui.Dialog({
		title: 'SDI status',
		fields: [
			{
				fieldname: "status_table",
				fieldtype: "Table",
				label: "SDI Communication Status",
				cannot_add_rows: true,
				in_place_edit: false,
				data: esiti,
				fields: [
					{
						fieldname: "esito",
						fieldtype: "Data",
						in_list_view: 1,
						label: "Esito",
						options: ""
					},
					{
						fieldname: "dataora_ricezione",
						fieldtype: "Data",
						in_list_view: 1,
						label: "Ora Ricezione",
						options: ""
					},
					{
						fieldname: "codice_errore",
						fieldtype: "Data",
						in_list_view: 1,
						label: "Codice Errore",
						options: ""
					},
					
					{
						fieldname: "descrizione",
						fieldtype: "Data",
						in_list_view: 1,
						label: "Descrizione",
						options: ""
					},
					{
						fieldname: "suggerimento",
						fieldtype: "Data",
						in_list_view: 1,
						label: "Suggerimento",
						options: ""
					},
				]
			}
		],
		primary_action_label: 'Close',
		primary_action(values) {
			console.log(values);
			d.hide();
		}
	});

	
	d.$wrapper.find('.modal-dialog').css("width", "800px");
	d.show();

	}
	
}

erpnext.setup_e_invoice_button = (doctype) => {
	frappe.ui.form.on(doctype, {
		refresh: (frm) => {
			if(frm.doc.docstatus == 1) {
				frm.add_custom_button('Generate E-Invoice', () => {
					frm.call({
						method: "erpnext.regional.italy.utils.generate_single_invoice",
						args: {
							docname: frm.doc.name
						},
						callback: function(r) {
							frm.reload_doc();
							if(r.message) {
								open_url_post(frappe.request.url, {
									cmd: 'frappe.core.doctype.file.file.download_file',
									file_url: r.message
								});
							}
						}
					});
				}); 
				frm.add_custom_button('Send to SDI', () => { 
					frm.call({
						method: "erpnext.regional.italy.utils.send_data_sdi",
						args: {
							docname: frm.doc.name
						},
						callback: function(r) {
							frm.reload_doc();
							if (r.message) {
								console.log(r.message) 
								frappe.show_alert({
								message:__(r.message),
								indicator:'orange'
								}, 5);
							}
						}
					});
				});
				frm.add_custom_button('Check SDI', () => {
					console.log(frm.doc.name)
					frm.call({
						method: "erpnext.regional.italy.utils.check_sdi_status",
						args: {
							docname: frm.doc.name
						},
						callback: function(r) {
							if (r.message) {
								show_esito(r.message)
							}
						}
					});
				});
			}
		}
	});
};
