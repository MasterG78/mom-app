import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// Create styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#fff',
        padding: 8, // Increased padding
    },
    labelContainer: {
        width: '100%', 
        height: '100%', 
        border: '2px solid #000',
        display: 'flex',
        flexDirection: 'column', // Changed to column for stacked rows
        padding: 10,
    },
    leftCol: {
        width: '60%',
        paddingRight: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start', // Fields will be stacked with margins
    },
    rightCol: {
        width: '40%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'space-between', // Push address to absolute bottom
        height: '100%', // Take full remaining height
    },
    row: {
        flexDirection: 'row',
        width: '100%',
    },
    addressBlock: {
        alignItems: 'flex-end',
    },
    addressText: {
        fontSize: 8, // Smallest possible for readability
        textAlign: 'right',
        lineHeight: 1.3,
    },
    qrWrapper: {
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        // No flex: 1 here to avoid pushing things too much
    },
    tagNumber: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'left', // Requested left justify
    },
    productName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12, // Space before the detailed row
    },
    qtyText: {
        fontSize: 16, 
        fontWeight: 'bold',
        marginBottom: 10, // "Blank line" spacing
    },
    detailText: {
        fontSize: 8,
        marginBottom: 10, // "Blank line" spacing
    },
    qrCode: {
        width: 90, 
        height: 90,
    },
});

export const InventoryTagPDF = ({ data, qrCodeUrl, copies = 1 }) => {
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Document>
            {/* 6 inches wide x 4 inches high. 72 points per inch. 6*72=432, 4*72=288. */}
            {/* Explicitly defined size order: [Width, Height] */}
            {Array.from({ length: copies }).map((_, index) => (
                <Page key={index} size={[432, 288]} style={styles.page}>
                <View style={styles.labelContainer}>
                    {/* Top Section: Tag # and Product Description */}
                    <Text style={styles.tagNumber}>{data.tag}</Text>
                    <Text style={styles.productName}>{data.product_name}</Text>
                    
                    {/* Bottom Section: Details and QR code */}
                    <View style={styles.row}>
                        <View style={styles.leftCol}>
                            {data.boardfeet ? (
                                <Text style={styles.qtyText}>BdFt: {data.boardfeet}</Text>
                            ) : data.quantity ? (
                                <Text style={styles.qtyText}>Qty: {data.quantity}</Text>
                            ) : null}

                            <Text style={styles.detailText}>{data.species_name || ''}</Text>
                            <Text style={styles.detailText}>Line: {data.line} | Date: {formatDate(data.produced)}</Text>
                        </View>

                        <View style={styles.rightCol}>
                            <View style={styles.qrWrapper}>
                                {qrCodeUrl && <Image src={qrCodeUrl} style={styles.qrCode} />}
                            </View>
                            <View style={styles.addressBlock}>
                                <Text style={styles.addressText}>Mountain Oak Mill</Text>
                                <Text style={styles.addressText}>11343 US-27 E</Text>
                                <Text style={styles.addressText}>Hamilton, GA  31811</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Page>
            ))}
        </Document>
    );
};
