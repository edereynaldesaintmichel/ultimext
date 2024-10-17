let minitable_instances = [];

let json_minitables = {};

function formatDate(dateString) {
    let date = new Date(dateString);
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function sortClientSide() {
    let order_column = this.order.column;
    if (order_column) {
        this.data.sort((a, b) => {
            const float_a = parseFloat(a[order_column]);
            const float_b = parseFloat(b[order_column]);
            if (float_a == a[order_column] && float_b == b[order_column]) {
                compare = float_a < float_b ? 1 : -1;
            } else {
                compare = String(a[order_column]).localeCompare(b[order_column]);
            }
            if (this.order.dir == 'asc') {
                return -compare;
            } else {
                return compare;
            }
        });
    }
    this.start = 0;
    this.table.dispatchEvent(new CustomEvent('sortComplete'));

    return this;
}

function initDom() {
    let parent_div = this.table.parentNode;
    this.initial_html ??= parent_div.innerHTML;

    let filters = document.createElement('tr');
    const closest_tr = this.thead_ths[0].closest('tr');
    if (closest_tr) {
        closest_tr.classList.add('column_headers');
    }

    // Column Filters
    for (let column_header of this.thead_ths) {
        if (column_header.getAttribute('data-sortable') !== false) {
            column_header.classList.add('sortable');
        }
        const data_sort_by = column_header.getAttribute('data-sort_by');
        if (data_sort_by) {
            this.order.column = column_header.getAttribute('data-column');
            this.order.dir = data_sort_by;
        }
        let th = document.createElement('th');
        th.classList.add('p-1');
        const exact_search = column_header.getAttribute('data-exact_search') === "true";
        const input = document.createElement('input');

        for (const attribute of column_header.attributes) {
            input.setAttribute(attribute.name, attribute.value);
        }
        input.className = "search_column form-control";
        input.style.width = "100%";
        input.placeholder = column_header.innerHTML.trim();
        input.required = true;
        input.title = exact_search ? "Recherche exacte." : "Recherche intelligente. \nExemples: \n^Expr pour filtrer les données commençant par 'Expr' \nexpr$ pour filtrer les données finissant par 'expr'. \nSinon, fonctionne comme un filtre 'contient'. \nPour plus d'informations, double-clickez sur le champ.";
        // input.ondblclick = e => window.open('https://blog.netwrix.fr/2019/10/31/expressions-regulieres-pour-debutants-comment-se-lancer-dans-la-decouverte-de-donnees-sensibles/', '_blank');
        // th.innerHTML = `<input data-exact_search="${column_header.getAttribute('data-exact_search')}" data-column="${column_header.getAttribute('data-column')}" class="search_column form-control" placeholder="${column_header.innerHTML.trim()}" style="width: 100%"/>`;
        th.appendChild(input);
        filters.appendChild(th);
    }
    this.table.querySelector('thead').appendChild(filters);
    let wrapper = document.createElement('div');
    wrapper.classList.add('table_wrapper');
    wrapper.id = this.table.id + '_wrapper';
    let wrapper_header = document.createElement('div');
    wrapper_header.id = wrapper.id + '_header';
    wrapper_header.className = 'row mb-3 table_wrapper_header';
    wrapper_header.innerHTML = `
    <div class="col-lg-3 d-flex align-items-center p-0 mb-3">
        <label id="global_search_label" class="mb-0"> 
            <input id="global_search_input" class="global_search form-control" placeholder="Rechercher sur toutes les colonnes" required/>
        </label>
    </div>
    <div class="col-lg-9 justify-content-end align-items-center d-flex p-0">
        <button class="btn btn-outline-secondary reset_filters">RAZ filtres</button>
        <button class="btn btn-outline-primary export_csv ms-3">Exporter (csv)</button>
        <button id="new" class="btn btn-primary ms-3">Nouveau</button>
    </div>
    `;

    const wrapper_body = document.createElement('div');
    wrapper_body.classList.add('table_wrapper_body');
    wrapper_body.appendChild(this.table);

    if (this.serverside) {
        wrapper_header.querySelector('#global_search_input').classList.add('d-none');
    }

    if (this.readonly) {
        wrapper_header.querySelector('#new').remove();
    }

    /* Footer */
    let wrapper_footer = document.createElement('div');
    wrapper_footer.className = "row mt-3";
    wrapper_footer.id = wrapper.id + '_footer';
    let pagination_container = document.createElement('div');
    pagination_container.classList.add('col-lg-4');
    let info_container = pagination_container.cloneNode();
    let spacer = pagination_container.cloneNode();
    pagination_container.className = 'col-lg-4 d-flex justify-content-end';
    let nav = document.createElement('nav');
    let ul = document.createElement('ul');
    ul.classList.add('pagination');
    nav.appendChild(ul);
    pagination_container.appendChild(nav);
    wrapper_footer.appendChild(info_container);
    wrapper_footer.appendChild(spacer);
    wrapper_footer.appendChild(pagination_container);

    wrapper.appendChild(wrapper_header);
    wrapper.appendChild(wrapper_body);
    wrapper.appendChild(wrapper_footer);
    parent_div.appendChild(wrapper);
    this.wrapper = wrapper;
    this.info_container = info_container;
    this.pagination = ul;

    let search_columns = this.search.columns;
    for (let column_name in search_columns) {
        let input = this.table.querySelector(`thead input[data-column="${column_name}"]`);
        if (input.value != search_columns[column_name].value) {
            input.value = search_columns[column_name].value.replaceAll('\\', '');
        }
    }
    this.computedPadding = parseFloat(window.getComputedStyle(wrapper_body, null).padding) || 0;
    this.table.dispatchEvent(new CustomEvent('initDomComplete'));

    return this;
}


function filterClientSide() {
    let search_columns = this.search.columns;
    let nb_columns_to_search = Object.keys(search_columns).length;

    this.data = this.last_response.data.filter((row) => {
        let counter = 0;
        for (let column_name in search_columns) {
            let column = search_columns[column_name];

            if (column.exact == true) {
                if (column.value != row[column_name]) {
                    return false;
                }
                counter++;
                continue;
            }
            if (!(new RegExp(column.value, 'i')).test(row[column_name])) {
                return false;
            }
            counter++;
        }
        if (nb_columns_to_search == counter) {
            return true;
        }
    });

    let table_columns = this.columns;
    const search_global = this.search.global;
    if (search_global) {
        this.data = this.data.filter((row) => {
            let counter = 0;
            for (let column_name in table_columns) {
                if ((new RegExp(search_global, 'i')).test(row[column_name])) {
                    counter++;
                }
            }
            if (1 <= counter) {
                return true;
            }
        });
    }

    this.start = 0;
    this.records_filtered = this.data.length;

    this.table.dispatchEvent(new CustomEvent('filterComplete'));
    return this;
}


function loadPropertiesFromUrl() {
    let url = new URL(location.href);
    this.start = parseInt(url.searchParams.get('start')) ?? 0;
    this.start = isNaN(this.start) ? 0 : this.start;
    this.on_load_start = this.start;
    try {
        let order = JSON.parse(url.searchParams.get('order'))
        this.order = order ?? this.order;
    } catch (e) {
        console.log(e);
    }
    try {
        let search = JSON.parse(url.searchParams.get('search'))
        this.search = search ?? this.search;
    } catch (e) {
        console.log(e);
    }

    return this;
}



function pushPropertiesToUrl() {
    let url = new URL(location.href);
    let search_params = url.searchParams;
    search_params.set('start', this.start);
    search_params.set('order', JSON.stringify(this.order));
    search_params.set('search', JSON.stringify(this.search));

    window.history.replaceState(null, null, url);

    return this;
}

async function retrieveData() {
    if (this.url == null) {
        return this;
    }
    this.table.dispatchEvent(new CustomEvent('beforeFetchSent'));
    let params = {
        start: this.start,
        length: this.page_length,
    }
    const response = await this.getServerDataResponse(params);

    this.last_response = response;
    this.data = [...response.data];
    this.records_filtered = response.recordsFiltered ?? this.data.length;
    this.records_total = response.recordsTotal ?? this.data.length;

    this.table.dispatchEvent(new CustomEvent('retrieveDataComplete', {
        detail:
        {
            data: this.data
        }
    }));

    return this;
}

function updatePagination() {
    this.pagination.innerHTML = "";
    this.info_container.innerHTML = "";

    let current_page_number = Math.ceil((this.start + 1) / this.page_length);
    let max_page_number = Math.ceil(this.records_filtered / this.page_length);
    let page_numbers = [];

    for (let i = 1; i <= max_page_number; i++) {
        if (i == 1 || i == max_page_number || Math.abs(i - current_page_number) < 2) {
            page_numbers.push(i);
        }
    }

    for (let i = 0; i < page_numbers.length; i++) {
        let page_number = page_numbers[i];

        if (page_numbers[i - 1] && Math.abs(page_number - page_numbers[i - 1]) > 1) {
            let li_dot = document.createElement('li');
            li_dot.className = 'page-item disabled';
            li_dot.innerHTML = `<a href="#!" class="page-link" disabled>...</a>`;
            this.pagination.appendChild(li_dot);
        }

        let li = document.createElement('li');
        li.classList.add('page-item');
        if (page_number == current_page_number) {
            li.classList.add('active');
        }
        li.innerHTML = `<a href="#!" class="page-link" data-start="${(page_number - 1) * this.page_length}">${page_number}</a>`;
        this.pagination.appendChild(li);
    }

    this.info_container.innerHTML = `Résultats ${this.start + 1} à ${Math.min(this.start + this.page_length, this.records_filtered)} sur ${this.records_filtered}`;

    this.table.dispatchEvent(new CustomEvent('updatePaginationComplete'));

    return this;
}

function render() {
    this.table.style.tableLayout = "auto";
    for (let column in this.columns) {
        this.columns[column].th.classList.remove('sort_asc', 'sort_desc');
        this.columns[column].th.classList.add('sortable');
    }

    if (this.order.column) {
        let th = this.columns[this.order.column].th;
        th.classList.remove('sortable');
        th.classList.add(`sort_${this.order.dir}`);
    }

    this.updatePagination();

    this.tbody.innerHTML = "";
    let start = this.serverside ? 0 : this.start;
    let max = this.serverside ? Math.min(this.page_length, this.data.length) : Math.min(this.data.length, this.start + this.page_length);

    let date_columns = [];
    for (let column in this.data[0] ?? []) {
        let row_data = this.data[0];
        if (typeof row_data[column] === 'string' && !isNaN(Date.parse(row_data[column]))) {
            date_columns.push(column);
        }
    }
    const date_columns_set = new Set(date_columns);

    for (let i = start; i < max; i++) {
        let row_data = this.data[i];
        let tr = document.createElement('tr');
        tr.setAttribute('data-id', row_data.id);
        tr.setAttribute('data-row', JSON.stringify(row_data));
        tr.classList.add(this.created_row_class);
        for (let column_name in this.columns) {
            const column = this.columns[column_name];
            let td = document.createElement('td');
            if (column.className) {
                td.className = column.className;
            }
            if (column.color_column) {
                td.style.color = row_data[column.color_column];
            }
            let cell_data = row_data[column_name];
            let inner_html = cell_data;
            tr.appendChild(td);
            if (typeof cell_data == 'undefined') {
                continue;
            }
            if (column_name === "color") {
                inner_html = `<div class="minitable_color" style="background-color: ${cell_data};"></div>`;
                td.style.verticalAlign = 'middle';
            } else {
                if (date_columns_set.has(column_name) && typeof cell_data == "string") {
                    inner_html = cell_data.slice(0, 16);
                } else {
                    const as_float =  parseFloat(cell_data);
                    if (!isNaN(cell_data) && !isNaN(as_float)) {
                        inner_html = as_float.toLocaleString();
                    }
                }
            }
           
            
            td.innerHTML = inner_html;
            td.title = cell_data;
            // tr.appendChild(td);
        }
        this.rows.push(tr);
        this.tbody.appendChild(tr);
        this.table.dispatchEvent(new CustomEvent('rowCreated', { detail: { row: tr, data: row_data } }));
    }
    if (this.pushPropertiesToUrl) {
        this.pushPropertiesToUrl();
    }

    this.table.dispatchEvent(new CustomEvent('renderComplete', { bubbles: true }));
    if (this.serverside) {
        return this;
    }

    return this;
}



function sort() {
    if (this.serverside) {
        return this.sortServerSide();
    }
    return this.sortClientSide();
}

function filter() {
    for (let column_name in this.search.columns) {
        let column = this.search.columns[column_name];
        column.value = column.value.replaceAll('\\', "")/* .replaceAll('.', "\\.") */;
        if (!column.value && column.value != "0") {
            delete this.search.columns[column_name];
        }
    }
    this.search.global = this.search.global.replaceAll('\\', "")/* .replaceAll('.', "\\.") */;
    if (this.serverside) {
        return this.filterServerSide();
    }
    return this.filterClientSide();
}

async function reload() {
    let start = this.start;
    if (this.serverside) {
        (await this.retrieveData()).render();
        return this;
    }
    (await this.retrieveData()).filter().sort();
    this.start = start;
    this.render();
}


async function sortServerSide() {
    this.start = 0;
    let response = await this.retrieveData();
    this.table.dispatchEvent(new CustomEvent('sortComplete'));

    return response;
}

async function filterServerSide() {
    this.records_filtered = 0;
    this.start = 0;
    let response = await this.retrieveData();
    this.table.dispatchEvent(new CustomEvent('filterComplete'));

    return response;
}
function styleThemAll() {
    let thead_ths = [...this.thead_ths];
    let wrapper_width = this.wrapper.offsetWidth;
    let definite_width = 0;
    let nb_resizable_columns = thead_ths.length;
    let fixed_column_indices = [];
    let i = -1;
    for (const thead of thead_ths) {
        i++;
        const definite_column_width = parseFloat(thead.getAttribute('data-column_width'));
        if (definite_column_width) {
            definite_width += definite_column_width;
            nb_resizable_columns--;
            fixed_column_indices.push(i);
            continue;
        }
    }

    const width_to_distribute = wrapper_width - definite_width - this.computedPadding * 2;

    let index_of_oversized_columns = [];
    let legit_width = 0;
    i = -1;
    for (let th of thead_ths) {
        i++;
        const is_fixed_column = fixed_column_indices.indexOf(i) !== -1;
        if (is_fixed_column) {
            continue;
        }
        if (th.offsetWidth > (width_to_distribute / nb_resizable_columns)) {
            index_of_oversized_columns.push(i);
        } else {
            legit_width += th.offsetWidth;
        }
    }
    const available_width_minus_oversized_columns = width_to_distribute - legit_width;

    let column_sizes = [];

    for (let n = 0; n < thead_ths.length; n++) {
        let width;
        if (index_of_oversized_columns.indexOf(n) == -1) {
            width = parseFloat(this.thead_ths[n].getAttribute('data-column_width')) || this.thead_ths[n].offsetWidth;
        } else {
            width = Math.floor(available_width_minus_oversized_columns / index_of_oversized_columns.length)
        }

        column_sizes.push(width);
    }

    for (let i = 0; i < thead_ths.length; i++) {
        this.thead_ths[i].style.width = column_sizes[i] + "px";
    }

    this.table.style.tableLayout = 'fixed';
}



function exportCSV(data_to_export = null, include_headers = true) {
    data_to_export ??= this.data;
    const headers_translation = [...this.thead_ths].reduce((a, b) => {
        a[b.getAttribute('data-column')] = b.innerHTML.replace(/"/g, '""');
        return a;
    }, {});

    const header_array = Object.keys(data_to_export[0]).reduce((a, b) => {
        a.push(headers_translation[b] ?? b);
        return a;
    }, []);

    const headers = header_array.map(header => `"${header}"`).join(',') + '\r\n';
    let content = data_to_export.reduce((a, b) => {
        const row = Object.values(b).map(value => {
            if (value === null || value === undefined) return '""';
            return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
        return a + row + '\r\n';
    }, '');

    const bom = '\uFEFF';
    if (include_headers) {
        content = headers + content;
    }
    let file = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = window.URL.createObjectURL(file);
    a.download = `Export ${document.title} ${(new Date()).toLocaleString().replace(/[/\\?%*:|"<>]/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(a.href);
}

async function exportCSVServerSide(additional_params = {}, include_headers = true) {

    const response = await this.getServerDataResponse(additional_params);
    this.exportCSV(response.data, include_headers);
}

async function getServerDataResponse(additional_params = {}) {
    let params = {
        search: this.search,
        order: this.order,
        recordsFiltered: this.records_filtered,
        start: 0,
        length: 999999999999999999,
        ...additional_params
    }
    let resp = await fetch(this.url + '?' + urlString(params));

    let response = await resp.json();

    return response;
}

function resetSearchFields() {
    this.wrapper.querySelectorAll('input.search_column').forEach((input) => {
        input.value = '';
    });
    this.wrapper.querySelector('input.global_search').value = "";
}

function initDomCallbackServerSide() {
    for (let column in this.columns) {
        let th = this.columns[column].th;
        th.addEventListener('click', async (e) => {
            if (th.getAttribute('data-resized')) {
                th.removeAttribute('data-resized');
                return;
            }
            if (this.order.column == column) {
                this.order.dir = this.order.dir == 'asc' ? 'desc' : 'asc';
            } else {
                this.order = {
                    column,
                    dir: 'asc',
                };
            }

            let response = await this.sort();
            if (response) {
                this.render();
            }
        });
    }

    this.table.querySelectorAll('thead input.search_column').forEach((input, index) => {
        for (let event of ['input', 'change', 'clear']) {
            input.addEventListener(event, async (e) => {
                let column = input.getAttribute('data-column');
                let previous_search = this.search.columns[column] ?? { [column]: false };
                if (previous_search.value && previous_search.value == input.value) {
                    return;
                }
                this.search.columns[input.getAttribute('data-column')] = {
                    value: input.value,
                    exact: input.getAttribute('data-exact_search') === 'true',
                };
                let response = await this.filter();
                if (response) {
                    this.render();
                }
            });
        }
    });

    this.table.addEventListener('wheel', async (e) => {
        if (!this.handleWheelEvent(e)) {
            return;
        }
        (await this.retrieveData()).render();
    });

    this.wrapper.querySelector('button.reset_filters').addEventListener('click', async (e) => {
        this.start = 0;
        this.search.global = '';
        this.search.columns = {};
        this.order = {
            dir: 'desc',
            column: this.thead_ths[0].getAttribute('data-column'),
        };
        this.resetSearchFields();
        (await this.retrieveData()).render();
    });
}

function handleWheelEvent(e) {
    if (!e.shiftKey) {
        return false;
    }
    e.preventDefault();
    if (e.deltaY > 0 && this.start < this.records_filtered - this.page_length) {
        this.start += parseInt(this.page_length);
    } else if (e.deltaY < -0 && this.start > 0) {
        this.start -= parseInt(this.page_length);
    } else {
        return false;
    }

    return true;
}

function initDomCallbackClientSide() {
    for (let column in this.columns) {
        let th = this.columns[column].th;
        th.addEventListener('click', (e) => {
            if (th.getAttribute('data-resized')) {
                th.removeAttribute('data-resized');
                return;
            }
            if (this.order.column == column) {
                this.order.dir = (this.order.dir == 'asc') ? 'desc' : 'asc';
            } else {
                this.order = {
                    column,
                    dir: 'asc',
                };
            }
            this.sort().render();
        });
    }

    this.table.addEventListener('wheel', (e) => {
        if (!this.handleWheelEvent(e)) {
            return;
        }

        this.render();
    });

    this.table.querySelectorAll('thead input.search_column').forEach((input, index) => {
        for (let event of ['keyup', 'change', 'clear']) {
            input.addEventListener(event, (e) => {
                if ('Shift' == e.key) {
                    return;
                }
                this.search.columns[input.getAttribute('data-column')] = {
                    value: input.value,
                    exact: input.getAttribute('data-exact_search') === 'true',
                };
                this.filter().sort().render();
            });
        }

    });

    this.wrapper.querySelector('button.reset_filters').addEventListener('click', (e) => {
        this.start = 0;
        this.search.global = '';
        this.search.columns = {};
        this.order = {
            dir: 'desc',
            column: this.thead_ths[0].getAttribute('data-column'),
        };
        this.data = this.last_response.data;
        this.resetSearchFields();
        this.filter().sort().render();
    });

    this.wrapper.querySelector('input.global_search').addEventListener('keyup', (e) => {
        this.search.global = e.target.value;
        this.filter().sort().render();
    });
}


function addEventHandlers() {

    for (let column in this.columns) {
        let th = this.columns[column].th;
        th.addEventListener('mousedown', (e) => {
            const initial_x = e.clientX;
            const definite_column_width = parseFloat(th.getAttribute('data-column_width'));
            const initial_column_width = definite_column_width ? definite_column_width : th.offsetWidth;
            let add_resized_attribute = true;

            th.onmousemove = mouse_move_event => {
                const new_x = mouse_move_event.clientX;
                const x_move = new_x - initial_x;
                const column_width = initial_column_width + x_move;

                th.setAttribute('data-column_width', column_width);
                th.style.cursor = "col-resize";
                add_resized_attribute && th.setAttribute('data-resized', true);
                add_resized_attribute = false;
                this.styleThemAll();
            }
        });

        th.addEventListener('touchstart', e => {
            const initial_x = e.touches[0].screenX;
            const definite_column_width = parseFloat(th.getAttribute('data-column_width'));
            const initial_column_width = definite_column_width ? definite_column_width : th.offsetWidth;
            let add_resized_attribute = true;

            th.ontouchmove = touch_move_event => {
                const new_x = touch_move_event.touches[0].screenX;
                const x_move = new_x - initial_x;
                const column_width = initial_column_width + x_move;

                th.setAttribute('data-column_width', column_width);
                th.style.cursor = "col-resize";
                add_resized_attribute && th.setAttribute('data-resized', true);
                add_resized_attribute = false;
                this.styleThemAll();
            }
        });
    }


    document.addEventListener('mouseup', e => {
        for (let column in this.columns) {
            const th = this.columns[column].th;
            th.onmousemove = null;
            th.style.cursor = "pointer";
        }
    });

    document.addEventListener('touchend', e => {
        for (let column in this.columns) {
            const th = this.columns[column].th;
            th.ontouchmove = null;
            th.style.cursor = "pointer";
        }
    });

    this.table.addEventListener('initDomComplete', (e) => {
        this.wrapper.querySelector('button.export_csv').addEventListener('click', async (e) => {
            if (this.serverside) {
                this.exportCSVServerSide();
                return;
            }
            this.exportCSV();
        });

        if (this.serverside) {
            this.initDomCallbackServerSide();
            return;
        }
        this.wrapper.querySelector('input.global_search').value = this.search.global.replaceAll('\\', '');
        this.initDomCallbackClientSide();
    });

    this.table.addEventListener('updatePaginationComplete', (e) => {
        for (let page_link of this.wrapper.querySelectorAll('.page-link:not(:disabled)')) {
            page_link.addEventListener('click', async (e) => {
                this.start = parseInt(page_link.getAttribute('data-start'));
                if (this.serverside) {
                    await this.retrieveData();
                }
                this.render();
            });
        }
    });

    this.table.addEventListener('renderComplete', (e) => {
        this.styleThemAll();
    });
}


function initServerSide() {
    (this.loadPropertiesFromUrl().initDom().retrieveData()).then((result) => {
        this.start = this.on_load_start;
        this.render();
    });
    return this;
}

function initClientSide() {
    (this.loadPropertiesFromUrl().initDom().retrieveData()).then((result) => {
        this.filter().sort();
        this.start = this.on_load_start;
        this.render();
    });
}

function destroy() {
    this.initial_container.innerHTML = this.initial_html;
    delete json_minitables[this.identifier];
    return null;
}


function MiniTable(table) {
    this.initial_container = table.parentNode;
    this.thead_ths = table.querySelectorAll('thead th');
    this.tbody = table.querySelector('tbody');
    this.serverside = table.classList.contains('serverside');
    this.readonly = table.classList.contains('readonly');
    this.page_length = table.getAttribute('data-page_length') ?? 10;
    this.url = table.getAttribute('data-url');
    this.start = 0;
    this.records_total = 0;
    this.records_filtered = 0;
    this.order = {
        dir: 'desc',
        column: this.thead_ths[0].getAttribute('data-column'),
    };
    this.search = {
        global: '',
        columns: {}
    };
    this.table = table;
    this.created_row_class = this.table.getAttribute('data-created_row_class');

    this.columns = [...this.thead_ths].reduce((a, b, index) => {
        a[b.getAttribute('data-column')] = {
            th: b,
            index,
            exact_search: b.getAttribute('data-exact_search'),
            className: b.getAttribute('data-class'),
            color_column: b.getAttribute('data-color_column'),
        };
        return a;
    }, {});
    this.rows = [];
    
    this.initDom = initDom;
    this.handleWheelEvent = handleWheelEvent;
    this.sortClientSide = sortClientSide;
    this.filterClientSide = filterClientSide;
    this.loadPropertiesFromUrl = loadPropertiesFromUrl;
    this.pushPropertiesToUrl = pushPropertiesToUrl;
    this.retrieveData = retrieveData;
    this.updatePagination = updatePagination;
    this.render = render;
    this.sort = sort;
    this.filter = filter;
    this.sortServerSide = sortServerSide;
    this.filterServerSide = filterServerSide;
    this.styleThemAll = styleThemAll;
    this.exportCSV = exportCSV;
    this.exportCSVServerSide = exportCSVServerSide;
    this.resetSearchFields = resetSearchFields;
    this.initDomCallbackServerSide = initDomCallbackServerSide;
    this.initDomCallbackClientSide = initDomCallbackClientSide;
    this.addEventHandlers = addEventHandlers;
    this.initServerSide = initServerSide;
    this.initClientSide = initClientSide;
    this.addEventHandlers = addEventHandlers;
    this.reload = reload;
    this.destroy = destroy;
    this.getServerDataResponse = getServerDataResponse;

    this.addEventHandlers();

    if (this.serverside) {
        this.initServerSide();
        return;
    }

    this.initClientSide();
}


function JsonMiniTable(table, values) {
    const unique_id = table.getAttribute('data-json_minitable_id');
    this.last_response = { data: values };
    this.data = values;
    this.records_filtered = values.length;
    this.records_total = this.records_filtered;
    this.readonly = table.classList.contains('readonly');
    if (unique_id) {
        console.log(unique_id);
        let table = json_minitables[unique_id];
        table.last_response.data = values;
        table.data = values;
        table.records_filtered = values.length;
        table.records_total = this.records_filtered;
        table.render();
        return table;
    }
    this.initial_html = table.parentNode.innerHTML;
    this.initial_container = table.parentNode;
    this.identifier = Math.random().toString(36).slice(-10);
    json_minitables[this.identifier] = this;
    table.setAttribute('data-json_minitable_id', this.identifier);
    // table.classList.add('minitable');
    const thead = table.tHead;
    let thead_ths = [];
    for (const column in values[0]) {
        if (column.startsWith('hidden')) {
            continue;
        }
        let th = document.createElement('th');
        th.setAttribute('data-column', column);
        th.classList.add('p-2')
        th.innerHTML = column;
        thead.appendChild(th);
        thead_ths.push(th);
    }

    this.thead_ths = thead_ths;
    this.tbody = table.querySelector('tbody');
    this.serverside = false;
    this.page_length = table.getAttribute('data-page_length') ?? 10;
    this.url = table.getAttribute('data-url');
    this.start = 0;
    this.order = {
        dir: 'desc',
        column: this.thead_ths[0].getAttribute('data-column'),
    };
    this.search = {
        global: '',
        columns: {}
    };
    this.table = table;
    this.created_row_class = this.table.getAttribute('data-created_row_class');

    this.columns = [...this.thead_ths].reduce((a, b, index) => {
        a[b.getAttribute('data-column')] = {
            th: b,
            index,
            exact_search: b.getAttribute('data-exact_search')
        };
        return a;
    }, {});
    this.rows = [];

    this.initDom = initDom;
    this.handleWheelEvent = handleWheelEvent;
    this.updatePagination = updatePagination;
    this.render = render;
    this.sort = sortClientSide;
    this.filter = filterClientSide;
    this.styleThemAll = styleThemAll;
    this.exportCSV = exportCSV;
    this.resetSearchFields = resetSearchFields;
    this.initDomCallbackClientSide = initDomCallbackClientSide;
    this.addEventHandlers = addEventHandlers;
    this.initClientSide = initClientSide;
    this.addEventHandlers = addEventHandlers;
    this.destroy = destroy;
    this.addEventHandlers();

    this.initDom().render();
}