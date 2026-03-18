import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// Create styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#fff',
        padding: 4, // Reduced padding to allow maximum space
    },
    labelContainer: {
        width: '100%', // Fill available space (288-8 = 280pt)
        height: '100%', // Fill available space (144-8 = 136pt)
        border: '1px solid #000',
        display: 'flex',
        flexDirection: 'row',
        padding: 4,
    },
    leftCol: {
        width: '65%',
        paddingRight: 5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    rightCol: {
        width: '35%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    addressBlock: {
        alignItems: 'flex-end',
    },
    addressText: {
        fontSize: 6.5,
        textAlign: 'right',
        lineHeight: 1.3,
    },
    qrWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    tagNumber: {
        fontSize: 36,
        fontWeight: 'heavy',
        marginBottom: 5,
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    qtyText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    detailText: {
        fontSize: 9,
        marginBottom: 1,
    },
    qrCode: {
        width: 80,
        height: 80,
    },
});

export const InventoryTagPDF = ({ data, qrCodeUrl, copies = 1 }) => {
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Document>
            {/* 4 inches wide x 2 inches high. 72 points per inch. 4*72=288, 2*72=144. */}
            {/* Explicitly defined size order: [Width, Height] */}
            {Array.from({ length: copies }).map((_, index) => (
                <Page key={index} size={[288, 144]} style={styles.page}>
                <View style={styles.labelContainer}>
                    <View style={styles.leftCol}>
                        <Text style={styles.tagNumber}>{data.tag}</Text>
                        <Text style={styles.productName}>{data.product_name}</Text>
                        
                        {/* Qty / BdFt just below description */}
                        {data.boardfeet ? (
                            <Text style={styles.qtyText}>BdFt: {data.boardfeet}</Text>
                        ) : data.quantity ? (
                            <Text style={styles.qtyText}>Qty: {data.quantity}</Text>
                        ) : null}

                        <Text style={styles.detailText}>{data.species_name || ''}</Text>
                        <Text style={styles.detailText}>Line: {data.line} | Date: {formatDate(data.produced)}</Text>
                    </View>

                    <View style={styles.rightCol}>
                        <View style={styles.addressBlock}>
                            <Text style={styles.addressText}>Mountain Oak Mill</Text>
                            <Text style={styles.addressText}>11343 US-27 E</Text>
                            <Text style={styles.addressText}>Hamilton, GA  31811</Text>
                        </View>
                        <View style={styles.qrWrapper}>
                            {qrCodeUrl && <Image src={qrCodeUrl} style={styles.qrCode} />}
                        </View>
                    </View>
                </View>
            </Page>
            ))}
        </Document>
    );
};
